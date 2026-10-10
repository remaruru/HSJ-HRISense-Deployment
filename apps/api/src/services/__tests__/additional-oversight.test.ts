import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { expandOversight } from '../additional-oversight.service';

const emp = (id: string, jobRoleId: string, immediateSupervisorId: string | null = null) => ({ id, jobRoleId, immediateSupervisorId });

describe('additional oversight — who it puts on the Org Chart', () => {
  const people = [
    emp('sister', 'SISTER'),
    emp('ks', 'KITCHEN_SUP'),
    emp('laundry1', 'LAUNDRY', 'ks'),
    emp('laundry2', 'LAUNDRY', 'ks'),
  ];

  test('a job-role target covers everyone holding the role; their primary supervisor is untouched', () => {
    const pairs = expandOversight([{ id: 'r1', overseerId: 'sister', overseenEmployeeId: null, overseenJobRoleId: 'LAUNDRY', overseenJobRole: { title: 'Laundry Staff' } }], people);
    assert.deepEqual(pairs.map((p) => p.overseenId).sort(), ['laundry1', 'laundry2']);
    assert.ok(pairs.every((p) => p.viaJobRoleTitle === 'Laundry Staff'));
    assert.equal(people.find((p) => p.id === 'laundry1')!.immediateSupervisorId, 'ks');
  });

  test('never oneself, never someone who already reports to the overseer', () => {
    const pairs = expandOversight([
      { id: 'r1', overseerId: 'ks', overseenEmployeeId: null, overseenJobRoleId: 'LAUNDRY' },
      { id: 'r2', overseerId: 'ks', overseenEmployeeId: null, overseenJobRoleId: 'KITCHEN_SUP' },
    ], people);
    assert.deepEqual(pairs, []);
  });

  test('an employee target and a role target naming the same person give one line', () => {
    const pairs = expandOversight([
      { id: 'r1', overseerId: 'sister', overseenEmployeeId: 'ks', overseenJobRoleId: null },
      { id: 'r2', overseerId: 'sister', overseenEmployeeId: null, overseenJobRoleId: 'KITCHEN_SUP' },
    ], people);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].relationshipId, 'r1');
  });

  test('an archived overseer or overseen person (not in the active list) draws nothing', () => {
    assert.deepEqual(expandOversight([{ id: 'r1', overseerId: 'gone', overseenEmployeeId: 'ks', overseenJobRoleId: null }], people), []);
    assert.deepEqual(expandOversight([{ id: 'r1', overseerId: 'sister', overseenEmployeeId: 'gone', overseenJobRoleId: null }], people), []);
  });
});
