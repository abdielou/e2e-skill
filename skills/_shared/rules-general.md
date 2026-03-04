# Rules

## General

1. **NEVER capture or log credentials** — Strictly prohibited
2. **NEVER start the application** — This skill assumes the app is already running. If the app is not reachable at `localhost`, tell the user to start it and **stop**. Do not run `npm run dev`, `dotnet run`, `docker-compose up`, or any other command to launch the application.
3. **NEVER create Node.js project artifacts in `e2e-scenarios/`** — Do not create `package.json`, `tsconfig.json`, `package-lock.json`, or install `node_modules` inside `e2e-scenarios/`. Specs run via `npx playwright test` which uses the root project's Playwright and TypeScript setup. If a spec has type errors, fix the spec — do not scaffold a separate Node project to work around it.
4. **Link tickets when known** — Always include `Covers: #<ticket>` when the scenario traces to a work item

## Explore + Build Modes

5. **Explore only writes `COVERAGE.md`** — It catalogs and reports gaps but does not create scenario files. The user decides what to build.
6. **Build never writes `.spec.ts` files** — Build mode only produces `.md` scenario files. Run mode handles spec generation.
7. **Build always confirms before writing** — Show the draft, get approval, then write.
8. **Respect existing coverage** — Don't suggest scenarios that duplicate what's already covered. If adding to an existing file, read it first.
9. **Scenarios must follow the format** — All `.md` files must match the **Scenario File Format** (see `../_shared/scenario-format.md`).
