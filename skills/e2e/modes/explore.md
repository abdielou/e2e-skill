# Explore Mode

When `/e2e explore` is invoked:

## Step 0: Check for Existing Catalog

Before scanning, check if `e2e-scenarios/COVERAGE.md` already exists.

**If the catalog exists:**

1. Read `e2e-scenarios/COVERAGE.md` and **display the feature list** to the user so they can see what's cataloged
2. Then use **AskUserQuestion** to ask:

> What would you like to do?
> 1. **Full rebuild** — Re-scan the entire codebase from scratch
> 2. **Update a feature area** — Re-explore a specific area and merge into existing catalog
> 3. **Cancel** — Keep the current catalog as-is

- If **Full rebuild**: Continue to Step 1 (full scan, overwrites existing catalog)
- If **Update a feature area**: Ask which feature area to update (show the areas from the existing catalog as options, plus "Other" for a new area). Then run Step 2 scoped to only that area, read the existing `COVERAGE.md`, and merge the updated section into it. Skip to Step 4 to write the merged catalog.
- If **Cancel**: Stop here.

**If the catalog does NOT exist**, proceed directly to Step 1.

---

## Step 1: Catalog Existing Coverage

1. Read all `e2e-scenarios/**/scenario.md` files (one per scenario folder)
2. Extract every `## Scenario:` heading and its description
3. Build a list of what's already covered (pages, flows, operations)

## Step 2: Scan the Codebase

Use **Explore subagents** to discover all user-facing features. Launch multiple subagents **in the same message as parallel (non-background) Task calls** so they run concurrently and return results before you proceed. Do NOT use `run_in_background` — this causes a stall where you wait for user input instead of continuing automatically.

When updating a single feature area (from Step 0), scope the scan to only that area's routes, components, and handlers instead of the full codebase.

**Model selection:** Set each subagent's `model` parameter based on the active profile (see Phase -2 model lookup table in `modes/run.md`).

Focus on:

1. **Routes/Pages** — Find all route definitions in the frontend app
   - Look for page/route files based on the framework (e.g., `page.tsx` for Next.js, `+page.svelte` for SvelteKit, route configs for React Router)
   - Map each route to its purpose (list, detail, create, edit)

2. **CRUD Operations** — For each entity/feature area, identify:
   - Create flows (forms, wizards)
   - Read/View pages (detail views, list views)
   - Update flows (edit forms)
   - Delete operations
   - Special operations (clone, import, export, download)

3. **UI Features** — Look for:
   - Filters and search functionality
   - Sorting and pagination
   - Modals and dialogs
   - Notifications and toasts
   - File upload/download

4. **Backend Endpoints** — Scan API handlers for operations that should have UI coverage:
   - Look for handlers, controllers, or API route files
   - Cross-reference with frontend to confirm UI exists

## Step 3: Cross-Reference

Compare discovered features against existing scenarios:
- **Covered** — Feature has at least one scenario
- **Partially covered** — Feature exists but key flows are missing (e.g., create is covered but edit is not)
- **Not covered** — No scenario exists for this feature

## Step 4: Write Catalog & Display Report

**Save the catalog** to `e2e-scenarios/COVERAGE.md` using the **Write** tool. This file is a **simple feature catalog** — it only stores Feature names and Descriptions. Status, scenario paths, and dates are inferred dynamically by the dashboard from the filesystem.

The catalog file format — **a simple two-column table**:

```markdown
# E2E Coverage Catalog

> Last updated: [date]
>
> This file catalogs all known features. Status is inferred dynamically — run `/e2e` to see the dashboard.

| Feature | Description |
|---------|-------------|
| Order List | List view with filters, sorting, pagination, export |
| Order Creation | Multi-step wizard: details, quantities, review |
| Order Edit | Edit form with clone, date changes, price updates |
| User List | User directory with search and role filters |
| User Profile | View/edit profile, change password, preferences |
| Reports | Generate, download, schedule reports |
```

Column definitions:
- **Feature** — The user-facing feature name (concise)
- **Description** — Brief summary of what the feature includes (key flows, operations)

**No status, file paths, or dates** — these are stale the moment they're written. The dashboard infers them from the filesystem.

Then **display the table** to the user and show next steps:

```
## Explore Complete

Catalog saved to `e2e-scenarios/COVERAGE.md`

[full table displayed here]

To see live status:  /e2e
To build scenarios:  /e2e build <area>/<flow>
```

**Stop here** — the user decides which gaps to fill.
