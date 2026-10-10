/**
 * Seeds the HRISense demo dataset (prisma/demo/demo-data.json) into the
 * database in DATABASE_URL: the reference data, the DEV- demo accounts and
 * their example records. Run it after `prisma migrate deploy`.
 *
 * Safe for a hosted database:
 *   - Never deletes and never resets anything.
 *   - Never changes a row that already exists. A row is recognised by its id or
 *     by its natural key (a job role's code, a user's email, a leave balance's
 *     employee + year + type, …), so running it twice creates nothing the second
 *     time, and rows a migration already created (e.g. the Sister job role) are
 *     reused, not duplicated.
 *   - Checks the whole dataset first: if a demo row would clash with a different
 *     existing row on a unique value, it stops before writing anything.
 *   - Demo passwords come from DEMO_ACCOUNT_PASSWORD and are stored as bcrypt
 *     hashes like every other HRISense password. Existing accounts keep their
 *     password unless --reset-passwords is given.
 *
 * Usage (from apps/api):
 *   DEMO_ACCOUNT_PASSWORD='…' node prisma/demo/seed-demo.js
 *   node prisma/demo/seed-demo.js --dry-run           report only, write nothing
 *   node prisma/demo/seed-demo.js --reset-passwords   also reset demo passwords
 */

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const { getDemoPassword, hashDemoPassword, isDemoEmail, DEMO_PASSWORD_ENV } = require('./demo-accounts');
const { seedDevAccounts } = require('../../src/scripts/seed_dev_accounts');

const DATA_FILE = path.join(__dirname, 'demo-data.json');
const CHUNK = 200;

/** Natural keys used to recognise an existing row; other unique values only count as clashes. */
const MATCH_KEYS = {
  Employee: [['employeeNumber']],
  User: [['email']],
};

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const RESET_PASSWORDS = args.has('--reset-passwords');

const prisma = new PrismaClient();
const modelByName = Object.fromEntries(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const delegate = (name) => prisma[name[0].toLowerCase() + name.slice(1)];

function foreignKeys(model) {
  return model.fields
    .filter((f) => f.kind === 'object' && f.relationFromFields && f.relationFromFields.length === 1)
    .map((f) => ({ field: f.relationFromFields[0], target: f.type, required: f.isRequired }));
}

function uniqueKeys(model) {
  return [
    ...model.fields.filter((f) => f.isUnique && !f.isId).map((f) => [f.name]),
    ...model.uniqueFields.map((u) => [...u]),
  ];
}

/** JSON value → the type Prisma expects for this field. */
function fromJson(field, value) {
  if (value === null || value === undefined) return null;
  if (field.type === 'DateTime') return new Date(value);
  if (field.type === 'BigInt') return BigInt(value);
  if (field.type === 'Bytes') throw new Error(`Bytes fields are not supported (${field.name})`);
  return value;
}

/** How a unique value is compared: MySQL's default collation ignores case. */
function keyOf(fields, row) {
  return JSON.stringify(fields.map((f) => {
    const v = row[f];
    if (v instanceof Date) return v.toISOString();
    return typeof v === 'string' ? v.toLowerCase() : v == null ? null : String(v);
  }));
}

function databaseLabel() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return `${url.hostname}${url.port ? ':' + url.port : ''}${url.pathname}`;
  } catch {
    return '(DATABASE_URL could not be read)';
  }
}

/**
 * One pass over the dataset. With write=false it only works out what would
 * happen (and finds clashes); with write=true it creates the missing rows.
 */
async function run(data, write) {
  const remap = new Map(); // demo id → id of the existing row it matched
  const processed = new Set();
  const created = new Set(); // `${model}:${id}` of rows this run creates
  const deferred = []; // optional links set once their target exists
  const summary = [];
  const clashes = [];
  const passwordResets = [];
  let password = null;
  const demoPassword = () => (password = password || getDemoPassword());

  const remapValue = (v) => {
    if (!remap.size) return v;
    if (typeof v === 'string') return remap.get(v) ?? v;
    if (Array.isArray(v)) return v.map(remapValue);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remapValue(x)]));
    }
    return v;
  };

  for (const { model: name, rows: rawRows } of data.models) {
    const model = modelByName[name];
    if (!model) throw new Error(`The database schema has no model "${name}". Run prisma migrate deploy with this repository's migrations first.`);
    const fields = Object.fromEntries(model.fields.map((f) => [f.name, f]));
    const fks = foreignKeys(model);

    // 1. Convert, and point links and embedded ids at rows that already existed.
    const rows = rawRows.map((raw) => {
      const row = {};
      for (const [k, v] of Object.entries(raw)) {
        const field = fields[k];
        if (!field) throw new Error(`${name}.${k} is not in the database schema. Run prisma migrate deploy first.`);
        let value = fromJson(field, v);
        if (!field.isId && (field.type === 'String' || field.type === 'Json')) value = remapValue(value);
        row[k] = value;
      }
      return row;
    });

    // 2. Links to rows that come later (or to the same table) are filled in afterwards.
    const rowDeferred = new Map();
    for (const row of rows) {
      for (const fk of fks) {
        if (row[fk.field] == null || (processed.has(fk.target) && fk.target !== name)) continue;
        if (fk.required) throw new Error(`${name}.${fk.field} needs ${fk.target}, which comes later in the data file.`);
        if (!rowDeferred.has(row.id)) rowDeferred.set(row.id, []);
        rowDeferred.get(row.id).push({ field: fk.field, value: row[fk.field] });
        row[fk.field] = null;
      }
    }

    // 3. Recognise rows that already exist — by id, then by natural key.
    const existingIds = new Set();
    for (let i = 0; i < rows.length; i += 1000) {
      const ids = rows.slice(i, i + 1000).map((r) => r.id);
      for (const r of await delegate(name).findMany({ where: { id: { in: ids } }, select: { id: true } })) existingIds.add(r.id);
    }
    const allKeys = uniqueKeys(model);
    const matchKeys = MATCH_KEYS[name] || allKeys;
    const lookups = new Map();
    const lookup = async (keyFields) => {
      const tag = keyFields.join('+');
      if (!lookups.has(tag)) {
        const firstValues = [...new Set(rows.map((r) => r[keyFields[0]]).filter((v) => v != null))];
        const map = new Map();
        if (firstValues.length) {
          const select = Object.fromEntries([['id', true], ...keyFields.map((f) => [f, true])]);
          for (let i = 0; i < firstValues.length; i += 1000) {
            const found = await delegate(name).findMany({ where: { [keyFields[0]]: { in: firstValues.slice(i, i + 1000) } }, select });
            for (const r of found) map.set(keyOf(keyFields, r), r.id);
          }
        }
        lookups.set(tag, map);
      }
      return lookups.get(tag);
    };

    const toCreate = [];
    let matched = 0;
    for (const row of rows) {
      if (existingIds.has(row.id)) { matched++; continue; }
      let existingId = null;
      for (const keyFields of matchKeys) {
        if (keyFields.some((f) => row[f] == null)) continue;
        existingId = (await lookup(keyFields)).get(keyOf(keyFields, row)) || null;
        if (existingId) break;
      }
      if (existingId) {
        remap.set(row.id, existingId);
        matched++;
        continue;
      }
      // A new row must not collide with a different existing row on any unique value.
      for (const keyFields of allKeys) {
        if (keyFields.some((f) => row[f] == null)) continue;
        if ((await lookup(keyFields)).has(keyOf(keyFields, row))) {
          clashes.push(`${name} ${row.id}: ${keyFields.join(' + ')} already used by another row`);
        }
      }
      toCreate.push(row);
    }

    // 4. Demo logins: hash DEMO_ACCOUNT_PASSWORD for new ones; reset existing ones only on request.
    if (name === 'User') {
      for (const row of toCreate) {
        row.passwordHash = write ? await hashDemoPassword(demoPassword()) : (demoPassword(), 'not-written');
      }
      if (RESET_PASSWORDS) {
        for (const row of rows) {
          if (!toCreate.includes(row) && isDemoEmail(row.email)) passwordResets.push({ id: remap.get(row.id) ?? row.id, email: row.email });
        }
      }
    }

    // 5. Create. Json columns left empty are omitted (Prisma stores NULL).
    if (write && toCreate.length) {
      const jsonFields = model.fields.filter((f) => f.type === 'Json').map((f) => f.name);
      const payload = toCreate.map((row) => {
        const out = { ...row };
        for (const f of jsonFields) if (out[f] == null) delete out[f];
        return out;
      });
      for (let i = 0; i < payload.length; i += CHUNK) {
        await delegate(name).createMany({ data: payload.slice(i, i + CHUNK) });
      }
    }
    for (const row of toCreate) {
      created.add(`${name}:${row.id}`);
      for (const d of rowDeferred.get(row.id) || []) deferred.push({ name, id: row.id, ...d });
    }
    processed.add(name);
    summary.push({ name, total: rows.length, created: toCreate.length, existing: matched });
  }

  // 6. Fill in the deferred links of the rows created above.
  if (write) {
    for (const d of deferred) {
      await delegate(d.name).update({ where: { id: d.id }, data: { [d.field]: remap.get(d.value) ?? d.value } });
    }
    for (const u of passwordResets) {
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: await hashDemoPassword(demoPassword()), mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, isActive: true },
      });
    }
  }
  return { summary, clashes, deferred: deferred.length, passwordResets: passwordResets.length };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (data.format !== 'hrisense-demo-data/1') throw new Error(`Unexpected demo data format: ${data.format}`);

  console.log(`HRISense demo seed → ${databaseLabel()}${DRY_RUN ? '  (dry run — nothing is written)' : ''}`);

  // Check everything first; write only if the whole dataset fits.
  const check = await run(data, false);
  if (check.clashes.length) {
    console.error(`\nStopped before writing anything: ${check.clashes.length} demo row(s) clash with existing data.`);
    for (const c of check.clashes.slice(0, 20)) console.error(`  ${c}`);
    process.exitCode = 1;
    return;
  }
  const result = DRY_RUN ? check : await run(data, true);

  console.log(`\n${'Table'.padEnd(32)} ${'in file'.padStart(8)} ${DRY_RUN ? 'would create' : 'created'.padStart(8)} ${'already there'.padStart(14)}`);
  for (const s of result.summary) {
    console.log(`${s.name.padEnd(32)} ${String(s.total).padStart(8)} ${String(s.created).padStart(DRY_RUN ? 12 : 8)} ${String(s.existing).padStart(14)}`);
  }
  if (RESET_PASSWORDS) console.log(`\nDemo passwords ${DRY_RUN ? 'to reset' : 'reset'}: ${result.passwordResets}`);

  if (!DRY_RUN) {
    // Any active job role still without a demo account gets one.
    await seedDevAccounts({ prisma });
  }
  const createdAny = result.summary.some((s) => s.name === 'User' && s.created > 0);
  if (createdAny || RESET_PASSWORDS) console.log(`\nDemo account password: the value of ${DEMO_PASSWORD_ENV} (not shown).`);
  console.log(DRY_RUN ? '\nDry run finished.' : '\nDemo seed finished.');
}

main()
  .catch((err) => {
    console.error(`\nDemo seed failed: ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
