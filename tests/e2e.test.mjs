// Unit tests for skills/run/scripts/e2e.mjs. Run: node --test tests/
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  UserError,
  specWasRun,
  assertionChanges,
  assertionFingerprint,
  buildStatus,
  checkContract,
  hashScenario,
  maskSource,
  parseCoverage,
  parseScenario,
  parseSpec,
  renderConfigTemplate,
  renderResults,
  renderStatus,
  scenarioPaths,
  summarizeReport,
} from "../skills/run/scripts/e2e.mjs";

const SCENARIO = `# Login Flow

Standard authentication flow.

Covers: #1024, #1031

## Context

- User must NOT be authenticated

---

## Scenario: Successful login

### Description

Enter valid credentials.

### Expected

1. Redirects to /dashboard
2. The display name of the user
   appears in the header

---

## Scenario: Failed login with wrong password

### Description

Enter a wrong password.

### Expected

1. Error message "Invalid credentials" is visible
`;

function spec(hash, body) {
  return `// scenario: e2e-scenarios/auth/login/scenario.md
// scenario-sha256: ${hash}
import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
${body}
});
`;
}

const GOOD_BODY = `  test("Successful login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    await test.step("E1: Redirects to /dashboard", async () => {
      await expect(page).toHaveURL(/\\/dashboard/);
    });
    await test.step("E2: The display name of the user appears in the header", async () => {
      await expect(
        page.getByTestId("user-name"),
      ).toHaveText("Quinn");
      expect.soft(await page.title()).toBe("Dashboard");
    });
  });

  test("Failed login with wrong password", async ({ page }) => {
    await page.goto("/");
    await test.step('E1: Error message "Invalid credentials" is visible', async () => {
      await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
    });
  });`;

const goodSpec = () => spec(hashScenario(SCENARIO), GOOD_BODY);

test("the hash ignores line endings, trailing spaces, and a byte order mark", () => {
  const base = hashScenario(SCENARIO);
  assert.equal(hashScenario(SCENARIO.replace(/\n/g, "\r\n")), base);
  assert.equal(hashScenario("﻿" + SCENARIO), base);
  assert.equal(hashScenario(SCENARIO.replace(/\n/g, "  \n") + "\n\n"), base);
  assert.notEqual(hashScenario(SCENARIO.replace("Invalid credentials", "Wrong password")), base);
  assert.match(base, /^[0-9a-f]{64}$/);
});

test("parseScenario reads the title, the tickets, and the Expected items", () => {
  const parsed = parseScenario(SCENARIO);
  assert.equal(parsed.title, "Login Flow");
  assert.deepEqual(parsed.covers, ["#1024", "#1031"]);
  assert.deepEqual(
    parsed.scenarios.map((item) => item.name),
    ["Successful login", "Failed login with wrong password"],
  );
  assert.deepEqual(parsed.scenarios[0].expected, [
    "Redirects to /dashboard",
    "The display name of the user appears in the header",
  ]);
  assert.deepEqual(parsed.scenarios[1].expected, ['Error message "Invalid credentials" is visible']);
});

test("parseScenario ignores numbered lines outside the Expected section", () => {
  const text = `# T\n\n## Scenario: A\n\n### Description\n\n1. not an expectation\n\n### Expected\n\n1. real\n\n---\n\n1. after the rule\n\n\`\`\`\n## Scenario: in a fence\n\`\`\`\n`;
  const parsed = parseScenario(text);
  assert.equal(parsed.scenarios.length, 1);
  assert.deepEqual(parsed.scenarios[0].expected, ["real"]);
});

test("maskSource keeps the length and hides comments, strings, and regular expressions", () => {
  const src = `const a = "test.step('x')"; // test.only(\n/* expect( */ const r = /expect\\(/; const b = \`\${a} test(\`;`;
  const { masked } = maskSource(src);
  assert.equal(masked.length, src.length);
  assert.ok(!masked.includes("test.step"));
  assert.ok(!masked.includes("test.only"));
  assert.ok(!masked.includes("expect"));
  assert.ok(!masked.includes("test("));
});

test("parseSpec reads the header, the tests, the steps, and the assertions", () => {
  const parsed = parseSpec(goodSpec());
  assert.equal(parsed.header.scenario, "e2e-scenarios/auth/login/scenario.md");
  assert.equal(parsed.header.hash, hashScenario(SCENARIO));
  assert.deepEqual(
    parsed.tests.map((item) => item.title),
    ["Successful login", "Failed login with wrong password"],
  );
  const [first, second] = parsed.tests;
  assert.deepEqual(first.steps.map((step) => step.id), [1, 2]);
  assert.deepEqual(first.steps[0].assertions, ["await expect(page).toHaveURL(/\\/dashboard/);"]);
  assert.deepEqual(first.steps[1].assertions, [
    'await expect( page.getByTestId("user-name"), ).toHaveText("Quinn");',
    'expect.soft(await page.title()).toBe("Dashboard");',
  ]);
  assert.equal(second.steps[0].text, 'Error message "Invalid credentials" is visible');
  assert.deepEqual(parsed.skips, []);
  assert.deepEqual(parsed.problems, []);
});

test("parseSpec ignores code in comments and strings", () => {
  const body = `  // test("Commented out", async () => {});
  test("Real", async ({ page }) => {
    const text = 'test.step("E9: in a string", () => {})';
    await test.step("E1: one", async () => {
      // await expect(page).toHaveURL("/x");
      await expect(page).toHaveTitle("T");
    });
  });`;
  const parsed = parseSpec(spec("0".repeat(64), body));
  assert.deepEqual(parsed.tests.map((item) => item.title), ["Real"]);
  assert.deepEqual(parsed.tests[0].steps.map((step) => step.id), [1]);
  assert.deepEqual(parsed.tests[0].steps[0].assertions, ['await expect(page).toHaveTitle("T");']);
});

test("parseSpec reports skipped tests, exclusive tests, and discouraged waits", () => {
  const body = `  test.skip("Declared skip", async ({ page }) => {});
  test.only("Exclusive", async ({ page }) => {
    test.fixme(true, "later");
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle");
    await page.pause();
  });
  test.describe.skip("Group", () => {});`;
  const parsed = parseSpec(spec("0".repeat(64), body));
  assert.deepEqual(parsed.skips.map((item) => item.kind).sort(), ["test.describe.skip", "test.fixme", "test.skip"]);
  const messages = parsed.problems.map((item) => item.message).join("\n");
  assert.match(messages, /test\.only/);
  assert.match(messages, /waitForTimeout/);
  assert.match(messages, /networkidle/);
  assert.match(messages, /pause/);
  assert.deepEqual(parsed.tests.map((item) => item.title), ["Declared skip", "Exclusive"]);
});

test("checkContract gives each state", () => {
  assert.equal(checkContract(SCENARIO, null).state, "scenario-only");
  assert.equal(checkContract(SCENARIO, goodSpec().replace(/\/\/ scenario-sha256.*\n/, "")).state, "legacy");
  assert.equal(checkContract(SCENARIO.replace("Redirects", "Goes"), goodSpec()).state, "stale");
  const ready = checkContract(SCENARIO, goodSpec());
  assert.equal(ready.state, "ready");
  assert.deepEqual(ready.errors, []);
});

test("checkContract finds each kind of gap", () => {
  const hash = hashScenario(SCENARIO);
  const errorsOf = (body) => checkContract(SCENARIO, spec(hash, body)).errors.join("\n");

  const noTest = errorsOf(GOOD_BODY.replace('test("Failed login with wrong password"', 'test("Something else"'));
  assert.match(noTest, /No test for scenario "Failed login with wrong password"/);
  assert.match(noTest, /Test "Something else" is not a scenario/);

  assert.match(errorsOf(GOOD_BODY.replace("E2: The display name", "E3: The display name")), /no step for E2/);
  assert.match(errorsOf(GOOD_BODY.replace("E2: The display name", "E3: The display name")), /step E3 has no Expected item/);
  assert.match(errorsOf(GOOD_BODY.replace("Redirects to /dashboard", "Goes to the dashboard")), /title of step E1 is not the Expected text/);
  assert.match(
    errorsOf(GOOD_BODY.replace('await expect(page.getByRole("alert")).toHaveText("Invalid credentials");', "await page.reload();")),
    /step E1 has no assertion/,
  );
  assert.match(errorsOf(GOOD_BODY.replace('await page.goto("/");', 'await page.goto("/"); await page.waitForTimeout(100);')), /waitForTimeout/);
  assert.equal(checkContract(SCENARIO, spec(hash, GOOD_BODY.replace("E1: Redirects", "E1: Redirects"))).state, "ready");
});

test("checkContract reports problems in the scenario file", () => {
  const twice = SCENARIO.replace("Failed login with wrong password", "Successful login");
  assert.match(checkContract(twice, null).errors.join("\n"), /two scenarios with the name "Successful login"/);
  const empty = "# T\n\n## Scenario: A\n\n### Description\n\nText.\n";
  assert.match(checkContract(empty, null).errors.join("\n"), /has no Expected items/);
});

test("the assertion fingerprint changes only when an assertion changes", () => {
  const base = assertionFingerprint(parseSpec(goodSpec()));
  const actionChanged = goodSpec().replace('name: "Sign in"', 'name: "Log in"');
  const assertionChanged = goodSpec().replace('toHaveText("Invalid credentials")', 'toContainText("Invalid")');
  assert.equal(assertionFingerprint(parseSpec(actionChanged)), base);
  assert.notEqual(assertionFingerprint(parseSpec(assertionChanged)), base);
});

function report(results, { setup } = {}) {
  const suites = [
    {
      title: "auth\\login\\scenario.spec.ts",
      file: "auth/login/scenario.spec.ts",
      specs: [],
      suites: [
        {
          title: "Login Flow",
          specs: results.map(([title, status, last]) => ({
            title,
            file: "auth/login/scenario.spec.ts",
            tests: [{ projectName: "e2e", status, results: last ? [last] : [] }],
          })),
        },
      ],
    },
    {
      title: "other\\thing\\scenario.spec.ts",
      file: "other/thing/scenario.spec.ts",
      specs: [{ title: "Other", file: "other/thing/scenario.spec.ts", tests: [{ projectName: "e2e", status: "expected", results: [{ status: "passed", duration: 1 }] }] }],
    },
  ];
  if (setup) {
    suites.unshift({
      title: "auth.setup.ts",
      file: "auth.setup.ts",
      specs: [{ title: "authenticate", file: "auth.setup.ts", tests: [{ projectName: "setup", status: "unexpected", results: [setup] }] }],
    });
  }
  return { suites, stats: { duration: 2900 }, errors: [] };
}

test("summarizeReport gives the result of each Expected item", () => {
  const scenario = parseScenario(SCENARIO);
  const summary = summarizeReport(
    report([
      [
        "Successful login",
        "expected",
        { status: "passed", duration: 300, steps: [{ title: "E1: Redirects to /dashboard" }, { title: "E2: The display name of the user appears in the header" }], attachments: [] },
      ],
      [
        "Failed login with wrong password",
        "unexpected",
        {
          status: "failed",
          duration: 1800,
          error: { message: "\u001b[31mError: expect(locator).toHaveText(expected) failed\u001b[39m\n\nLocator: getByRole('alert')" },
          steps: [{ title: 'E1: Error message "Invalid credentials" is visible', error: { message: "Error: expect failed\nExpected: \"Invalid credentials\"" } }],
          attachments: [{ name: "trace", path: path.join(process.cwd(), "e2e-scenarios", ".results", "artifacts", "x", "trace.zip") }],
        },
      ],
    ]),
    "auth/login",
    scenario,
  );
  assert.deepEqual(summary.totals, { passed: 1, failed: 1, flaky: 0, skipped: 0 });
  assert.equal(summary.tests.length, 2);
  assert.equal(summary.tests[0].expectedPassed, 2);
  assert.equal(summary.tests[1].expectedPassed, 0);
  const text = renderResults("auth/login", summary, { report: "e2e-scenarios/.results/html/index.html" });
  assert.match(text, /\| 1 \| Successful login \| 2\/2 \| 0\.3s \| PASS \|/);
  assert.match(text, /\| 2 \| Failed login with wrong password \| 0\/1 \| 1\.8s \| FAIL \|/);
  assert.match(text, /E1 Error message "Invalid credentials" is visible: Error: expect failed \/ Expected: "Invalid credentials"/);
  assert.match(text, /show-trace "e2e-scenarios\/\.results\/artifacts\/x\/trace\.zip"/);
  assert.ok(!text.includes("\u001b"));
});

test("summarizeReport reports a failure in an action, a flaky test, and a setup failure", () => {
  const scenario = parseScenario(SCENARIO);
  const summary = summarizeReport(
    report(
      [
        ["Successful login", "unexpected", { status: "timedOut", duration: 1500, error: { message: "TimeoutError: locator.click: Timeout 1500ms exceeded." }, steps: [], attachments: [] }],
        ["Failed login with wrong password", "flaky", { status: "passed", duration: 200, steps: [{ title: 'E1: Error message "Invalid credentials" is visible' }], attachments: [] }],
      ],
      { setup: { status: "failed", duration: 10, error: { message: "Error: Set E2E_USERNAME and E2E_PASSWORD" } } },
    ),
    "auth/login",
    scenario,
  );
  assert.deepEqual(summary.totals, { passed: 0, failed: 1, flaky: 1, skipped: 0 });
  const text = renderResults("auth/login", summary);
  assert.match(text, /Failed before E1, in an action: TimeoutError/);
  assert.match(text, /FLAKY/);
  assert.match(text, /passed on a retry/);
  assert.match(text, /Auth setup failed: Error: Set E2E_USERNAME and E2E_PASSWORD/);
});

test("an error message loses its box characters", () => {
  const message = "Error: browserType.launch: Executable doesn't exist\n╔══════════╗\n║ Looks like Playwright was just installed or updated. ║\n╚══════════╝";
  const summary = summarizeReport(report([], { setup: { status: "failed", duration: 1, error: { message } } }), "auth/login", null);
  assert.deepEqual(summary.setupFailures, ["Error: browserType.launch: Executable doesn't exist / Looks like Playwright was just installed or updated."]);
  assert.match(renderResults("auth/login", summary), /No test ran\./);
});

test("summarizeReport marks a test that did not run", () => {
  const summary = summarizeReport(report([["Successful login", "skipped", null]]), "auth/login", parseScenario(SCENARIO));
  assert.deepEqual(summary.totals, { passed: 0, failed: 0, flaky: 0, skipped: 1 });
  assert.match(renderResults("auth/login", summary), /NOT RUN/);
});

test("parseCoverage reads the Path column and supports a catalog without it", () => {
  const withPath = parseCoverage("| Feature | Description | Path |\n|---|---|---|\n| Order List | Filters \\| sorting | `orders/list` |\n");
  assert.deepEqual(withPath, [{ feature: "Order List", description: "Filters \\| sorting", ref: "orders/list" }]);
  const legacy = parseCoverage("| Feature | Description |\n|---|---|\n| Deals - Delete | Delete with confirmation |\n| Reports | Generate |\n");
  assert.deepEqual(legacy.map((row) => row.ref), ["deals/delete", "reports"]);
});

test("the config template has a CommonJS form and an ES module form, with each line ending", () => {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills", "run", "templates", "playwright.config.ts");
  const lf = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const text of [lf, lf.replace(/\n/g, "\r\n")]) {
    const commonjs = renderConfigTemplate(text, false);
    assert.match(commonjs, /const here = __dirname;/);
    assert.ok(!commonjs.includes("E2E_IMPORTS") && !commonjs.includes("E2E_HERE") && !commonjs.includes("import.meta"));
    const esm = renderConfigTemplate(text, true);
    assert.match(esm, /import \{ fileURLToPath \} from "url";/);
    assert.match(esm, /const here = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/);
    assert.ok(!esm.includes("E2E_IMPORTS") && !esm.includes("E2E_HERE") && !esm.includes("__dirname"));
  }
});

test("scenarioPaths accepts the usual forms and rejects a path outside the folder", () => {
  const root = path.join(os.tmpdir(), "e2e-paths");
  for (const ref of ["auth/login", "auth/login/", "e2e-scenarios/auth/login", "auth\\login", "auth/login/scenario.md", "auth/login/scenario.spec.ts"]) {
    assert.equal(scenarioPaths(ref, root).ref, "auth/login");
  }
  assert.throws(() => scenarioPaths("../secrets", root), UserError);
  assert.throws(() => scenarioPaths("", root), UserError);
  assert.throws(() => scenarioPaths(".auth/state", root), UserError);
});

test("buildStatus joins the catalog, the files, and the run records", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-status-"));
  const dir = path.join(root, "e2e-scenarios");
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  write("COVERAGE.md", "| Feature | Description | Path |\n|---|---|---|\n| Login | Sign in | `auth/login` |\n| Password reset | Reset by email | `auth/reset` |\n");
  write("auth/login/scenario.md", SCENARIO);
  write("auth/login/scenario.spec.ts", goodSpec());
  write("auth/login/findings.md", "# Findings\n\n- [ ] open one\n- [x] closed one\n- [ ] open two\n");
  write("notes/add/scenario.md", SCENARIO.replace("# Login Flow", "# Notes"));
  write("stale/one/scenario.md", SCENARIO + "\nExtra line.\n");
  write("stale/one/scenario.spec.ts", goodSpec());
  write(
    ".results/runs/auth__login.json",
    JSON.stringify({ at: "2026-11-13T20:13:18.000Z", specHash: "different", totals: { passed: 1, failed: 1, flaky: 0, skipped: 0 }, tests: [{}, {}], setupFailures: [], globalErrors: [] }),
  );
  try {
    const status = buildStatus(root);
    const byRef = Object.fromEntries(status.rows.map((row) => [row.ref, row]));
    assert.equal(status.hasCatalog, true);
    assert.equal(byRef["auth/login"].state, "ready");
    assert.equal(byRef["auth/login"].findings, 2);
    assert.equal(byRef["auth/login"].lastRun.ok, false);
    assert.equal(byRef["auth/login"].lastRun.specChanged, true);
    assert.equal(byRef["auth/reset"].state, "not-covered");
    assert.equal(byRef["auth/reset"].next, "/e2e:build auth/reset");
    assert.equal(byRef["notes/add"].state, "scenario-only");
    assert.equal(byRef["notes/add"].feature, "Notes");
    assert.equal(byRef["stale/one"].state, "stale");
    assert.equal(byRef["stale/one"].next, "/e2e:run stale/one --regenerate");
    const text = renderStatus(status);
    assert.match(text, /\| \*\*Login\*\*: Sign in \| `auth\/login` \| 2 \| Spec ready \| FAIL 1\/2, .*spec changed after this run \| 2 \|/);
    assert.match(text, /4 features\. 1 spec ready, 1 scenario only, 1 not covered, 1 need regeneration, 1 failed on the last run\./);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("assertionChanges ignores a change to actions and reports a change to proof", () => {
  const base = goodSpec();
  assert.deepEqual(assertionChanges(base, base.replace('name: "Sign in"', 'name: "Log in"')).changes, []);

  // A change to the layout of an assertion is not a change to proof.
  const oneLine = base.replace(/await expect\(\s*page\.getByTestId\("user-name"\),\s*\)\.toHaveText/, 'await expect(page.getByTestId("user-name")).toHaveText');
  assert.notEqual(oneLine, base);
  assert.deepEqual(assertionChanges(base, oneLine).changes, []);
  assert.equal(assertionFingerprint(parseSpec(oneLine)), assertionFingerprint(parseSpec(base)));

  const weaker = assertionChanges(base, base.replace('toHaveText("Invalid credentials")', 'toHaveText("Wrong email or password")'));
  assert.equal(weaker.changes.length, 1);
  assert.equal(weaker.changes[0].test, "Failed login with wrong password");
  assert.equal(weaker.changes[0].id, 1);
  assert.match(weaker.changes[0].before, /Invalid credentials/);
  assert.match(weaker.changes[0].after, /Wrong email or password/);

  const removed = assertionChanges(base, base.replace(/    await test\.step\("E1: Redirects[\s\S]*?\}\);\n/, ""));
  assert.equal(removed.changes[0].after, "(step removed)");

  const skipped = assertionChanges(base, base.replace('    await page.goto("/");', '    test.fixme(true, "later");\n    await page.goto("/");'));
  assert.deepEqual(skipped.changes, []);
  assert.equal(skipped.skips.length, 1);
  assert.equal(skipped.skips[0].kind, "test.fixme");
});

function runGuard(payload) {
  const guard = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills", "run", "scripts", "guard.mjs");
  const child = spawnSync(process.execPath, [guard], { input: JSON.stringify(payload), encoding: "utf8" });
  assert.equal(child.status, 0);
  return child.stdout ? JSON.parse(child.stdout).hookSpecificOutput : null;
}

test("each subagent body is the same as the checklist file of its skill", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const body = (file) =>
    fs
      .readFileSync(path.join(root, file), "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .trim();
  assert.equal(body("agents/spec-reviewer.md"), body("skills/run/review.md"));
  assert.equal(body("agents/coverage-scanner.md"), body("skills/explore/scan.md"));
});

test("each path in a skill file exists and stays in the skills folder", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills");
  const files = fs
    .readdirSync(root, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 8);
  let found = 0;
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), "utf8");
    assert.ok(!text.includes("CLAUDE_PLUGIN_ROOT"), f);
    for (const m of text.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([^\s"'`)]+)/g)) {
      const target = path.join(root, path.dirname(f), m[1]);
      assert.ok(fs.existsSync(target), f + " -> " + m[1]);
      assert.ok(!path.relative(root, target).startsWith(".."), f + " -> " + m[1]);
      found += 1;
    }
  }
  assert.ok(found >= 10);
});

test("the guard asks the human before an agent reads the credentials or the saved session", () => {
  const read = (file) => runGuard({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: file } });
  for (const file of ["C:\\work\\app\\e2e-scenarios\\.env", "/home/me/app/e2e-scenarios/.env", "/home/me/app/e2e-scenarios/.auth/state.json"]) {
    const asked = read(file);
    assert.equal(asked.permissionDecision, "ask");
    assert.match(asked.permissionDecisionReason, /credentials/);
  }
  for (const file of ["/home/me/app/e2e-scenarios/.env.example", "/home/me/app/.env", "/home/me/app/e2e-scenarios/auth/login/scenario.md"]) {
    assert.equal(read(file), null);
  }
});

test("the guard asks the human only for a change to the proof of an established spec", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-guard-"));
  const dir = path.join(root, "e2e-scenarios", "auth", "login");
  const file = path.join(dir, "scenario.spec.ts");
  const record = path.join(root, "e2e-scenarios", ".results", "runs", "auth__login.json");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "scenario.md"), SCENARIO);
  fs.writeFileSync(file, goodSpec());
  const edit = (old_string, new_string) => ({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: file, old_string, new_string } });
  const weaken = edit('toHaveText("Invalid credentials")', 'toHaveText("Wrong email or password")');
  try {
    // A spec that no human saw: the agent still writes it.
    assert.equal(runGuard(weaken), null);

    fs.mkdirSync(path.dirname(record), { recursive: true });
    fs.writeFileSync(record, "{}");
    const asked = runGuard(weaken);
    assert.equal(asked.permissionDecision, "ask");
    assert.match(asked.permissionDecisionReason, /auth\/login/);
    assert.match(asked.permissionDecisionReason, /"Failed login with wrong password" E1/);
    assert.match(asked.permissionDecisionReason, /before: .*Invalid credentials/);
    assert.match(asked.permissionDecisionReason, /after: .*Wrong email or password/);

    // An edit to actions needs no question.
    assert.equal(runGuard(edit('name: "Sign in"', 'name: "Log in"')), null);
    // A skip needs a question.
    assert.match(runGuard(edit('    await page.goto("/");', '    test.skip(true, "x");\n    await page.goto("/");')).permissionDecisionReason, /adds test\.skip/);
    // A full rewrite with the same proof needs no question. A rewrite with other proof does.
    assert.equal(runGuard({ tool_name: "Write", tool_input: { file_path: file, content: goodSpec().replace("await page.goto", "await  page.goto") } }), null);
    assert.equal(runGuard({ tool_name: "Write", tool_input: { file_path: file, content: goodSpec().replace('toHaveText("Quinn")', "toBeVisible()") } }).permissionDecision, "ask");

    // The scenario changed, thus a new spec is expected.
    fs.writeFileSync(path.join(dir, "scenario.md"), SCENARIO.replace("Redirects to /dashboard", "Opens the dashboard"));
    assert.equal(runGuard(weaken), null);

    // Other files, and input that the guard cannot read, pass.
    assert.equal(runGuard({ tool_name: "Edit", tool_input: { file_path: path.join(root, "src", "app.ts"), old_string: "a", new_string: "b" } }), null);
    assert.equal(runGuard({}), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("specWasRun is true only when the last run record is for the current spec text", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-wasrun-"));
  try {
    const paths = scenarioPaths("notes/add", root);
    fs.mkdirSync(paths.dir, { recursive: true });
    fs.mkdirSync(path.dirname(paths.record), { recursive: true });
    fs.writeFileSync(paths.spec, "const a = 1;\n");
    assert.equal(specWasRun("notes/add", root), false);
    const specHash = createHash("sha256").update("const a = 1;\n").digest("hex");
    fs.writeFileSync(paths.record, JSON.stringify({ specHash }));
    assert.equal(specWasRun("notes/add", root), true);
    fs.writeFileSync(paths.spec, "const a = 2;\n");
    assert.equal(specWasRun("notes/add", root), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
