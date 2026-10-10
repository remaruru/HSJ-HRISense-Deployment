# HRISense Help Center — Architecture

**Document version**: 3.0.0 — rewritten against the current code on 2026-09-02
**System title**: *HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision*
**Module**: `apps/web/src/pages/HelpCenter/`
**Routes**: `/help-center`, `/help-center/$guideSlug` (plus `/help` → redirect)

> Earlier versions of this document recorded checkpoint-era counts (38/39 entries,
> 34/17/11 → 36/19/13, "all Announcement guides are METADATA_ONLY"). Those numbers
> described a state the system has since left. They are not preserved here.

---

## 1. What the Help Center is

A role-aware, in-app set of written guides for HR staff, supervisors and employees.
It is deliberately **not** a chatbot and contains no AI: it is a structured,
searchable catalogue of instructions held in version control beside the code they
describe. There is no database table, no CMS and no external search service.

Design constraints it is built to satisfy:

- **Role isolation before search.** A user never sees a guide, a category, a search
  suggestion or a related link for something their tier cannot do.
- **No invented procedure.** A guide exists only for something a real user can
  actually do in the current build.
- **Plain language.** No API, database, Prisma, permission-enum, registry or
  content-status vocabulary appears in user-facing text.

---

## 2. File layout

```
apps/web/src/pages/HelpCenter/
├── helpCenter.types.ts        Types: roles, categories, guide/step/content shapes
├── helpCenter.registry.ts     Category declarations + guide aggregation
├── helpCenter.search.ts       Role filtering, search, category counts, validation
├── devGuideFixture.ts         Dev-only reader preview (never in production routing)
├── HelpCenterPage.tsx         Catalogue: hero, search, categories, common tasks
├── HelpGuidePage.tsx          Guide reader: steps, print, related guides
├── guides/                    The content, one file per area
│   ├── auth.guides.ts
│   ├── dashboard.guides.ts
│   ├── employees.guides.ts
│   ├── recruitment.guides.ts
│   ├── attendance.guides.ts
│   ├── leave.guides.ts
│   ├── performance.guides.ts
│   ├── compliance.guides.ts
│   ├── communication.guides.ts
│   └── administration.guides.ts
└── components/                Presentational pieces (see §6)
```

`helpCenter.registry.ts` holds the category declarations and concatenates the guide
arrays. Splitting the content into `guides/*.guides.ts` keeps each file reviewable;
before this pass every guide lived in one 1,357-line file.

Supporting code outside the module:

| File | Role |
|---|---|
| `apps/web/src/components/common/HelpLink.tsx` | Contextual **Help** action placed on workflow pages |
| `apps/web/scripts/validate-help-registry.ts` | Static registry check, run with `npx tsx` |

---

## 3. Types

```ts
type HelpRole = 'FULL' | 'SUPERVISOR' | 'STANDARD' | 'PUBLIC';
type HelpContentStatus = 'METADATA_ONLY' | 'DRAFT' | 'READY';
```

`PUBLIC` covers the pages a visitor reaches without signing in — the Careers pages
and the read-only application status link. The Help Center itself requires a
sign-in, so `PUBLIC` guides are tagged for `FULL` as well: HR are the people who
have to explain those pages to an applicant.

`HelpCategoryCode` currently declares **17** categories:

```
AUTH · DASHBOARD · EMPLOYEES · RECRUITMENT · PUBLIC_RECRUITMENT · ATTENDANCE ·
LEAVE · EVALUATIONS · TRAINING · COMPLIANCE · ANNOUNCEMENTS · NOTIFICATIONS ·
AUDIT · AI_ASSISTANCE · REPORTS · SETTINGS · HELP
```

A guide carries identity (`id`, `slug`, `title`, `shortDescription`, `module`,
`category`), audience (`roles`), discovery (`keywords`, `isRecommended`),
screenshot metadata (`screenshotRecommended`, `sensitiveScreenshot`), a
`contentStatus`, and the authored `content`: purpose, when to use, prerequisites,
numbered steps (each with instruction, optional explanation/tip/warning/info,
expected result and UI path), what happens next, troubleshooting, tips and
related guides.

---

## 4. Role filtering and search

| Function | Purpose |
|---|---|
| `getGuidesForRole(role)` | Every guide the role may read, regardless of status |
| `getReadyGuidesForRole(role)` | READY guides only — what the UI shows |
| `searchHelpGuides(query, role)` | Role-filtered, deterministically ranked search |
| `getGuideBySlug(slug, role?)` | Direct lookup, optionally role-checked |
| `getCategoriesForRole(role)` | Categories with READY counts; empty ones are hidden |
| `getMetadataCountsByRole()` | Development counts across all four roles |
| `validateHelpRegistry()` | Integrity check (see §5) |

Search ranks exact title (100) → title contains (75) → keyword (50) → module (30)
→ description (20), and searches only READY guides the role can read.

Category counts are derived from `HELP_CATEGORIES` at run time. They were
previously initialised from a hand-written literal of ten category codes, which
would have silently reported zero for any category added afterwards.

---

## 5. Registry validation

`validateHelpRegistry()` derives all counts from the registry and never asserts a
fixed total. It reports a defect for:

- a duplicate guide `id` or `slug`;
- a guide with an empty `roles` array (unreachable by everyone);
- a `READY` guide with no `content` (would render an empty page);
- an unknown `category` (would never be listed);
- an empty `keywords` array (unfindable by search);
- a related-guide link that does not exist, is not `READY`, or is readable by none
  of the roles that can read the linking guide.

Run it statically:

```
cd apps/web && npx tsx scripts/validate-help-registry.ts
```

It prints the totals per status, per category and per role, then PASS or the list
of defects. Current result: **79 guides, 79 READY, 0 DRAFT, 0 METADATA_ONLY, 17
categories, 0 defects.**

---

## 6. Components

| Component | Role |
|---|---|
| `HelpSearchBar` | Search input with role-appropriate suggestions |
| `HelpCategoryCard` | Category tile with its READY count and icon |
| `HelpGuideCard` | Guide tile used in listings and related guides |
| `HelpGuideStep` | One numbered step with its optional callouts |
| `HelpExpectedResult`, `HelpTip`, `HelpWarning`, `HelpInfo` | Step callouts |
| `HelpPrerequisites`, `HelpTroubleshooting`, `HelpRelatedGuides` | Guide sections |
| `HelpBreadcrumbs`, `HelpGuideNavigation`, `HelpRoleIndicator`, `HelpEmptyState` | Navigation and state |
| `HelpScreenshot`, `HelpScreenshotModal` | Screenshot rendering and zoom viewer |

`HelpRelatedGuides` filters to guides that exist, are READY, and are readable by
the current role — so a related link can never lead to an unavailable page. The
registry validator enforces the same rule at author time.

---

## 7. Screenshots

The screenshot architecture is intact and unused. `HelpScreenshot` renders only
when a step carries a `screenshot`, so guides without one render cleanly: no broken
image, no empty frame, no "coming soon" placeholder. `screenshotRecommended` and
`sensitiveScreenshot` flag which guides would benefit from a capture and which must
never show real personal or clinical data.

**No screenshot assets exist yet.** Capture is the only outstanding Help Center work.

---

## 8. Contextual help

`HelpLink` places a small **Help** action on a workflow page and opens that page's
guide. It resolves the guide for the signed-in role and renders **nothing** when the
guide does not exist or the role may not read it, so a page can never offer a link
that leads to "not available for your account".

It is used at page level, not on individual cards. Ten pages carry one today:
Employee Onboarding, Leave Requests, New Leave Request, Work Schedule, Daily
Monitoring, Compliance, Announcements, Applicant detail, AI Assistance and Reports.

---

## 9. Direct-URL states

| Situation | What the reader sees |
|---|---|
| Unknown slug | **Guide Not Found**, with a route back to the Help Center |
| Slug exists but the role may not read it | **Guide Not Available for Your Account** |
| Guide exists but is not READY | Notice that the guide is not available yet, with no invented steps |
| No READY guides for the role at all | Preparation notice on the Help Center home |

All four states are preserved. The third and fourth are currently unreachable,
because every guide in the registry is READY — they remain as the correct behaviour
if a future guide is added as metadata first.

---

## 10. Print support

`HelpGuidePage` offers **Print Guide**, which calls `window.print()`. Navigation,
the sidebar, the related-guides panel and the action bar are hidden with `print:`
utilities, so a printed guide is the title, the purpose, the prerequisites, the
steps and the troubleshooting — usable at a workstation.
