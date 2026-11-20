#!/usr/bin/env node
// Deterministic helper for the e2e plugin.
// It checks the contract between each scenario and its spec, runs specs,
// writes run evidence to disk, and prints the dashboard.
// It has no dependencies. Run it from the project root.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SCENARIOS_DIR = "e2e-scenarios";
export const MIN_PLAYWRIGHT = [1, 59, 0];
const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

// ---------------------------------------------------------------------------
// Scenario files
// ---------------------------------------------------------------------------

/** Make the text of a scenario file stable across operating systems. */
export function normalizeScenarioText(text) {
  const lines = text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n") + "\n";
}

/** The contract hash of a scenario file. A spec stores this value in its header. */
export function hashScenario(text) {
  return createHash("sha256").update(normalizeScenarioText(text), "utf8").digest("hex");
}

function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

/** Read the title, the ticket links, and each scenario with its Expected items. */
export function parseScenario(text) {
  const lines = normalizeScenarioText(text).split("\n");
  const result = { title: "", covers: [], scenarios: [] };
  let current = null;
  let inExpected = false;
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const textOfHeading = heading[2].trim();
      inExpected = false;
      if (level === 1 && !result.title) result.title = textOfHeading;
      const scenario = /^Scenario:\s*(.+)$/i.exec(textOfHeading);
      if (level === 2) {
        current = scenario ? { name: collapse(scenario[1]), expected: [] } : null;
        if (current) result.scenarios.push(current);
      } else if (level === 3 && current && /^Expected\b/i.test(textOfHeading)) {
        inExpected = true;
      }
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      inExpected = false;
      continue;
    }
    const covers = /^Covers:\s*(.+)$/i.exec(line.trim());
    if (covers && !current) {
      result.covers = covers[1].split(",").map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (!inExpected || !current) continue;
    const item = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (item) {
      current.expected.push(collapse(item[1]));
    } else if (line.trim() && current.expected.length) {
      // A continuation line of the previous item.
      current.expected[current.expected.length - 1] = collapse(
        current.expected[current.expected.length - 1] + " " + line,
      );
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Spec files
// ---------------------------------------------------------------------------

const ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };
const REGEX_PREFIX = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);

/**
 * Replace the content of comments, strings, and regular expressions with spaces.
 * The result has the same length as the source, thus an index is valid in both.
 */
export function maskSource(src) {
  const out = src.split("");
  const strings = new Map();
  const n = src.length;
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
  };
  let i = 0;
  let last = "";
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      const stop = src.indexOf("\n", i);
      const end = stop === -1 ? n : stop;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === "/" && d === "*") {
      const stop = src.indexOf("*/", i + 2);
      const end = stop === -1 ? n : stop + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      let value = "";
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") {
          const next = src[j + 1];
          value += next in ESCAPES ? ESCAPES[next] : next === "\n" ? "" : (next ?? "");
          j += 2;
          continue;
        }
        if (c === "`" && src[j] === "$" && src[j + 1] === "{") {
          let depth = 1;
          let k = j + 2;
          while (k < n && depth > 0) {
            if (src[k] === "{") depth++;
            else if (src[k] === "}") depth--;
            k++;
          }
          value += src.slice(j, k);
          j = k;
          continue;
        }
        value += src[j];
        j++;
      }
      const end = Math.min(j + 1, n);
      strings.set(i, { start: i, end, value });
      blank(i + 1, end - 1);
      last = c;
      i = end;
      continue;
    }
    if (c === "/" && REGEX_PREFIX.has(last)) {
      let j = i + 1;
      let inClass = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) break;
        j++;
      }
      blank(i + 1, j);
      last = ")";
      i = j + 1;
      continue;
    }
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return { masked: out.join(""), strings };
}

function matchingParen(masked, open) {
  let depth = 0;
  for (let k = open; k < masked.length; k++) {
    const c = masked[k];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return k;
    }
  }
  return masked.length - 1;
}

function lineOf(src, index) {
  let line = 1;
  for (let k = 0; k < index; k++) if (src[k] === "\n") line++;
  return line;
}

function assertionsIn(src, masked, from, to) {
  const found = [];
  const pattern = /(?<![.\w$])expect\s*(?:\.\s*(?:soft|poll)\s*)?\(/g;
  pattern.lastIndex = from;
  let match;
  let skipUntil = from;
  while ((match = pattern.exec(masked)) && match.index < to) {
    if (match.index < skipUntil) continue;
    let start = match.index;
    const before = masked.slice(Math.max(from, start - 12), start);
    const awaited = /await\s+$/.exec(before);
    if (awaited) start -= awaited[0].length;
    let depth = 0;
    let end = to;
    for (let k = match.index; k < to; k++) {
      const c = masked[k];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") {
        depth--;
        if (depth < 0) {
          end = k;
          break;
        }
      } else if (c === ";" && depth === 0) {
        end = k + 1;
        break;
      }
    }
    found.push(collapse(src.slice(start, end)));
    skipUntil = end;
  }
  return found;
}

/** Read the contract header, the tests, the Expected steps, and the assertions of a spec. */
export function parseSpec(src) {
  const header = {};
  const scenarioPath = /^\/\/\s*scenario:\s*(\S+)\s*$/m.exec(src);
  const scenarioHash = /^\/\/\s*scenario-sha256:\s*([0-9a-f]{64})\s*$/m.exec(src);
  if (scenarioPath) header.scenario = scenarioPath[1];
  if (scenarioHash) header.hash = scenarioHash[1];

  const { masked, strings } = maskSource(src);
  const tests = [];
  const skips = [];
  const problems = [];

  const testCall = /(?<![.\w$])test\s*(?:\.\s*(only|skip|fixme|fail)\s*)?\(\s*/g;
  let match;
  while ((match = testCall.exec(masked))) {
    const modifier = match[1];
    const open = masked.indexOf("(", match.index);
    const close = matchingParen(masked, open);
    const title = strings.get(match.index + match[0].length);
    const line = lineOf(src, match.index);
    // A test declaration has a title and a callback. Other calls are modifiers in a test body.
    if (!title || !masked.slice(title.end, close).trim().startsWith(",")) continue;
    const steps = [];
    const stepCall = /(?<![\w$])test\s*\.\s*step\s*\(\s*/g;
    stepCall.lastIndex = open;
    let step;
    while ((step = stepCall.exec(masked)) && step.index < close) {
      const stepOpen = masked.indexOf("(", step.index);
      const stepClose = matchingParen(masked, stepOpen);
      const stepTitle = strings.get(step.index + step[0].length);
      if (!stepTitle) continue;
      const id = /^E(\d+):\s*([\s\S]*)$/.exec(stepTitle.value);
      steps.push({
        title: stepTitle.value,
        id: id ? Number(id[1]) : null,
        text: id ? collapse(id[2]) : null,
        line: lineOf(src, step.index),
        assertions: assertionsIn(src, masked, stepTitle.end, stepClose),
      });
    }
    tests.push({ title: collapse(title.value), modifier: modifier || null, line, steps });
  }

  // A modifier can be on a test, on a group, or in a test body.
  const modifierCall = /(?<![.\w$])test\s*\.\s*(describe\s*\.\s*)?(only|skip|fixme|fail)\s*\(/g;
  while ((match = modifierCall.exec(masked))) {
    const line = lineOf(src, match.index);
    const kind = `test.${match[1] ? "describe." : ""}${match[2]}`;
    if (match[2] === "only") problems.push({ line, message: `\`${kind}\` limits the run` });
    else skips.push({ line, kind });
  }
  const forbidden = [
    [/\.\s*waitForTimeout\s*\(/g, "`waitForTimeout` is a fixed wait. Wait for an assertion instead"],
    [/\.\s*pause\s*\(/g, "`page.pause()` stops the run"],
  ];
  for (const [pattern, message] of forbidden) {
    while ((match = pattern.exec(masked))) problems.push({ line: lineOf(src, match.index), message });
  }
  for (const literal of strings.values()) {
    if (literal.value === "networkidle") {
      problems.push({ line: lineOf(src, literal.start), message: "`networkidle` is discouraged by Playwright. Wait for an assertion instead" });
    }
  }
  return { header, tests, skips, problems };
}

/** The code of an assertion with no layout: no spaces, no line breaks, no trailing commas. */
function canonical(code) {
  return code.replace(/\s+/g, "").replace(/,(?=[)\]}])/g, "");
}

/** A short hash of every assertion in the Expected steps. It changes when an assertion changes. */
export function assertionFingerprint(spec) {
  const data = spec.tests.map((test) => [
    test.title,
    test.steps.filter((step) => step.id !== null).map((step) => [step.id, step.assertions.map(canonical)]),
  ]);
  return createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 12);
}

/**
 * List what an edit changes in the proof of a spec: the assertions of each
 * Expected step, and each test that the edit skips. An edit to actions gives no change.
 * A change to the layout of an assertion is not a change.
 */
export function assertionChanges(beforeText, afterText) {
  const before = parseSpec(beforeText);
  const after = parseSpec(afterText);
  const changes = [];
  const index = (spec) => {
    const map = new Map();
    for (const test of spec.tests) {
      for (const step of test.steps) {
        if (step.id !== null) map.set(`${test.title}\u0000${step.id}`, step.assertions.join(" "));
      }
    }
    return map;
  };
  const was = index(before);
  const now = index(after);
  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const [title, id] = key.split("\u0000");
    const old = was.get(key);
    const next = now.get(key);
    if (old !== undefined && next !== undefined && canonical(old) === canonical(next)) continue;
    changes.push({ test: title, id: Number(id), before: old ?? "(no step)", after: next ?? "(step removed)" });
  }
  changes.sort((a, b) => a.test.localeCompare(b.test) || a.id - b.id);
  const skips = after.skips.slice(before.skips.length).map((skip) => ({ kind: skip.kind, line: skip.line }));
  return { changes, skips, beforeHash: before.header.hash || null, afterHash: after.header.hash || null };
}

// ---------------------------------------------------------------------------
// Contract check
// ---------------------------------------------------------------------------

/**
 * Compare a scenario with its spec.
 * States: scenario-only, legacy, stale, gap, ready.
 */
export function checkContract(scenarioText, specText) {
  const scenario = parseScenario(scenarioText);
  const hash = hashScenario(scenarioText);
  const base = { scenario, hash, errors: [], skips: [], fingerprint: null };
  const names = scenario.scenarios.map((item) => item.name);
  for (const name of new Set(names.filter((item, index) => names.indexOf(item) !== index))) {
    base.errors.push(`scenario.md has two scenarios with the name "${name}"`);
  }
  for (const item of scenario.scenarios) {
    if (!item.expected.length) base.errors.push(`Scenario "${item.name}" has no Expected items`);
  }
  if (specText === null) return { ...base, state: "scenario-only" };

  const spec = parseSpec(specText);
  base.skips = spec.skips;
  base.fingerprint = assertionFingerprint(spec);
  base.spec = spec;
  if (!spec.header.hash) return { ...base, state: "legacy" };
  if (spec.header.hash !== hash) return { ...base, state: "stale" };

  const errors = base.errors;
  for (const item of scenario.scenarios) {
    const test = spec.tests.find((candidate) => candidate.title === item.name);
    if (!test) {
      errors.push(`No test for scenario "${item.name}"`);
      continue;
    }
    item.expected.forEach((text, index) => {
      const id = index + 1;
      const step = test.steps.find((candidate) => candidate.id === id);
      if (!step) errors.push(`"${item.name}": no step for E${id} (${text})`);
      else if (step.text !== text) errors.push(`"${item.name}": the title of step E${id} is not the Expected text (line ${step.line})`);
      else if (!step.assertions.length) errors.push(`"${item.name}": step E${id} has no assertion (line ${step.line})`);
    });
    for (const step of test.steps) {
      if (step.id !== null && step.id > item.expected.length) {
        errors.push(`"${item.name}": step E${step.id} has no Expected item in scenario.md (line ${step.line})`);
      }
    }
  }
  for (const test of spec.tests) {
    if (!names.includes(test.title)) errors.push(`Test "${test.title}" is not a scenario in scenario.md (line ${test.line})`);
  }
  for (const problem of spec.problems) errors.push(`${problem.message} (line ${problem.line})`);
  return { ...base, state: errors.length ? "gap" : "ready" };
}

// ---------------------------------------------------------------------------
// Project files
// ---------------------------------------------------------------------------

function projectPaths(root = process.cwd()) {
  const dir = path.join(root, SCENARIOS_DIR);
  return {
    root,
    dir,
    config: path.join(dir, "playwright.config.ts"),
    settings: path.join(dir, "e2e.config.json"),
    env: path.join(dir, ".env"),
    seed: path.join(dir, "seed.spec.ts"),
    authSetup: path.join(dir, "auth.setup.ts"),
    authState: path.join(dir, ".auth", "state.json"),
    coverage: path.join(dir, "COVERAGE.md"),
    results: path.join(dir, ".results"),
  };
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

function toPosix(file) {
  return file.split(path.sep).join("/");
}

/** Read the `<area>/<scenario>` argument and return the paths of that scenario. */
export function scenarioPaths(ref, root = process.cwd()) {
  const clean = toPosix(ref || "")
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "")
    .replace(/^e2e-scenarios\//, "")
    .replace(/\/(scenario\.(md|spec\.ts))?$/, "");
  if (!clean || clean.split("/").some((part) => part === ".." || part.startsWith("."))) {
    fail(`"${ref}" is not a scenario path. Use <area>/<scenario>, for example auth/login.`);
  }
  const dir = path.join(root, SCENARIOS_DIR, ...clean.split("/"));
  return {
    ref: clean,
    dir,
    scenario: path.join(dir, "scenario.md"),
    spec: path.join(dir, "scenario.spec.ts"),
    findings: path.join(dir, "findings.md"),
    record: path.join(root, SCENARIOS_DIR, ".results", "runs", clean.replace(/\//g, "__") + ".json"),
  };
}

/** Find each folder below e2e-scenarios/ that has a scenario.md. */
export function listScenarioRefs(root = process.cwd()) {
  const base = path.join(root, SCENARIOS_DIR);
  const refs = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const next = path.join(dir, entry.name);
      if (fs.existsSync(path.join(next, "scenario.md"))) refs.push(toPosix(path.relative(base, next)));
      walk(next);
    }
  };
  walk(base);
  return refs.sort();
}

/** Read the names in a .env file. The values of secrets stay in this process. */
export function readEnvFile(file) {
  const values = {};
  const text = readText(file);
  if (text === null) return values;
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([\w]+)\s*=\s*(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

function readSettings(paths) {
  const text = readText(paths.settings);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { invalid: true };
  }
}

function resolveBaseURL(paths, settings) {
  return process.env.E2E_BASE_URL || readEnvFile(paths.env).E2E_BASE_URL || (settings && settings.baseURL) || "http://localhost:3000";
}

function playwrightInfo(root) {
  try {
    const require = createRequire(path.join(root, "package.json"));
    const manifest = require.resolve("@playwright/test/package.json");
    const version = JSON.parse(fs.readFileSync(manifest, "utf8")).version;
    return { version, cli: path.join(path.dirname(manifest), "cli.js") };
  } catch {
    return null;
  }
}

function versionAtLeast(version, minimum) {
  const parts = version.split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  for (let k = 0; k < 3; k++) {
    if ((parts[k] || 0) > minimum[k]) return true;
    if ((parts[k] || 0) < minimum[k]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** An error that the user can correct. The message is printed without a stack. */
export class UserError extends Error {}

function fail(message) {
  throw new UserError(message);
}

function option(args, name) {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(name + "="));
  if (index === -1) return undefined;
  const arg = args[index];
  if (arg.includes("=")) {
    args.splice(index, 1);
    return arg.slice(arg.indexOf("=") + 1);
  }
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function flag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

/**
 * Fill the two markers of the config template.
 * `__dirname` does not exist in an ES module project, thus the config has two forms.
 */
export function renderConfigTemplate(text, esm) {
  return text
    .replace(/\/\*E2E_IMPORTS\*\/\r?\n/, esm ? 'import { fileURLToPath } from "url";\n' : "")
    .replace("/*E2E_HERE*/", esm ? "const here = path.dirname(fileURLToPath(import.meta.url));" : "const here = __dirname;");
}

function commandInit(args) {
  const paths = projectPaths();
  const auth = option(args, "--auth");
  const baseURL = option(args, "--base-url");
  const replaceConfig = flag(args, "--replace-config");
  if (auth && !["scripted", "manual", "none"].includes(auth)) fail("--auth must be scripted, manual, or none.");
  fs.mkdirSync(paths.dir, { recursive: true });
  const report = [];
  const write = (target, content, label) => {
    if (fs.existsSync(target)) {
      report.push(`kept     ${label}`);
      return false;
    }
    fs.writeFileSync(target, content);
    report.push(`created  ${label}`);
    return true;
  };
  const template = (name) => fs.readFileSync(path.join(TEMPLATES, name), "utf8");

  let settings = readSettings(paths);
  if (!settings || settings.invalid) {
    settings = { baseURL: baseURL || "http://localhost:3000", auth: auth || "none" };
    fs.writeFileSync(paths.settings, JSON.stringify(settings, null, 2) + "\n");
    report.push("created  e2e.config.json");
  } else if (auth || baseURL) {
    if (auth) settings.auth = auth;
    if (baseURL) settings.baseURL = baseURL;
    fs.writeFileSync(paths.settings, JSON.stringify(settings, null, 2) + "\n");
    report.push("updated  e2e.config.json");
  } else {
    report.push("kept     e2e.config.json");
  }

  const currentConfig = readText(paths.config);
  if (currentConfig !== null && !currentConfig.includes("e2e.config.json")) {
    if (replaceConfig) {
      fs.renameSync(paths.config, paths.config + ".v2.bak");
      report.push("moved    playwright.config.ts to playwright.config.ts.v2.bak");
    } else {
      report.push("LEGACY   playwright.config.ts is from an earlier version. Run init again with --replace-config.");
    }
  }
  // The `type` field of package.json sets the form of the config.
  const packageText = readText(path.join(paths.root, "package.json"));
  let esm = false;
  try {
    esm = packageText !== null && JSON.parse(packageText).type === "module";
  } catch {
    esm = false;
  }
  const config = renderConfigTemplate(template("playwright.config.ts"), esm);
  write(paths.config, config, `playwright.config.ts (${esm ? "ES module" : "CommonJS"} project)`);
  write(paths.seed, template("seed.spec.ts"), "seed.spec.ts");
  write(path.join(paths.dir, ".gitignore"), template("gitignore"), ".gitignore");
  if (settings.auth === "scripted") {
    write(paths.authSetup, template("auth.setup.ts"), "auth.setup.ts (edit the locators)");
    write(path.join(paths.dir, ".env.example"), template("env.example"), ".env.example");
  }
  console.log(report.join("\n"));
  console.log(`\nauth mode: ${settings.auth}\nbase URL:  ${settings.baseURL}`);
}

async function reachable(url) {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, reason: error.cause?.code || error.name };
  }
}

async function commandPreflight(args) {
  const asJson = flag(args, "--json");
  const paths = projectPaths();
  const checks = [];
  const add = (name, ok, detail, fix) => checks.push({ name, ok, detail, ...(ok ? {} : { fix }) });

  const playwright = playwrightInfo(paths.root);
  if (!playwright) {
    add("playwright", false, "@playwright/test is not installed in this project", "npm install -D @playwright/test && npx playwright install chromium");
  } else {
    const ok = versionAtLeast(playwright.version, MIN_PLAYWRIGHT);
    add("playwright", ok, `@playwright/test ${playwright.version}`, `Update to ${MIN_PLAYWRIGHT.join(".")} or later: npm install -D @playwright/test@latest`);
  }

  const settings = readSettings(paths);
  const configText = readText(paths.config);
  if (!settings) add("settings", false, "e2e-scenarios/e2e.config.json is missing", "Run the init command.");
  else if (settings.invalid) add("settings", false, "e2e-scenarios/e2e.config.json is not valid JSON", "Correct the file.");
  else add("settings", true, `auth mode ${settings.auth || "none"}`);
  if (configText === null) add("config", false, "e2e-scenarios/playwright.config.ts is missing", "Run the init command.");
  else if (!configText.includes("e2e.config.json")) add("config", false, "playwright.config.ts is from an earlier version", "Run the init command with --replace-config.");
  else add("config", true, "playwright.config.ts");
  add("seed", fs.existsSync(paths.seed), "seed.spec.ts", "Run the init command.");

  const baseURL = resolveBaseURL(paths, settings);
  const app = await reachable(baseURL);
  add("app", app.ok, app.ok ? `${baseURL} answers (HTTP ${app.status})` : `${baseURL} does not answer (${app.reason})`, "Ask the human to start the application. Do not start it.");

  const auth = settings && !settings.invalid ? settings.auth || "none" : "none";
  if (auth === "scripted") {
    const env = { ...readEnvFile(paths.env), ...process.env };
    const missing = ["E2E_USERNAME", "E2E_PASSWORD"].filter((name) => !env[name]);
    add("credentials", missing.length === 0, missing.length ? `not set: ${missing.join(", ")}` : "E2E_USERNAME and E2E_PASSWORD are set", "Ask the human to set them in e2e-scenarios/.env. Do not read that file.");
    const setup = readText(paths.authSetup);
    add("auth setup", setup !== null && !setup.includes("TODO(e2e)"), setup === null ? "auth.setup.ts is missing" : setup.includes("TODO(e2e)") ? "auth.setup.ts has placeholder locators" : "auth.setup.ts", "Write the login steps in e2e-scenarios/auth.setup.ts.");
  } else if (auth === "manual") {
    const exists = fs.existsSync(paths.authState);
    const age = exists ? Math.round((Date.now() - fs.statSync(paths.authState).mtimeMs) / 3600000) : null;
    add("auth state", exists, exists ? `.auth/state.json, saved ${age} h ago` : ".auth/state.json is missing", "Do the manual login procedure.");
  }

  const ok = checks.every((check) => check.ok);
  if (asJson) {
    console.log(JSON.stringify({ ok, baseURL, auth, cli: "npx playwright cli", checks }, null, 2));
  } else {
    for (const check of checks) {
      console.log(`${check.ok ? "OK  " : "FAIL"}  ${check.name}: ${check.detail}`);
      if (!check.ok) console.log(`      fix: ${check.fix}`);
    }
    console.log(`\nbase URL: ${baseURL}\nauth mode: ${auth}\nbrowser CLI: npx playwright cli`);
  }
  process.exit(ok ? 0 : 1);
}

function loadContract(ref) {
  const paths = scenarioPaths(ref);
  const scenarioText = readText(paths.scenario);
  if (scenarioText === null) fail(`No scenario at ${toPosix(path.relative(process.cwd(), paths.scenario))}.`);
  return { paths, scenarioText, specText: readText(paths.spec), contract: checkContract(scenarioText, readText(paths.spec)) };
}

const STATE_TEXT = {
  "scenario-only": "No spec",
  legacy: "Spec has no contract header",
  stale: "Spec is stale: scenario.md changed after generation",
  gap: "Spec does not match the scenario",
  ready: "Spec matches the scenario",
};

function commandHash(args) {
  const { contract } = loadContract(args[0]);
  console.log(contract.hash);
}

// True if the last run record of the scenario is for the current text of its spec.
export function specWasRun(ref, root = process.cwd()) {
  const paths = scenarioPaths(ref, root);
  const record = readText(paths.record);
  const spec = readText(paths.spec);
  if (!record || !spec) return false;
  try {
    return JSON.parse(record).specHash === createHash("sha256").update(spec).digest("hex");
  } catch {
    return false;
  }
}

function commandCheck(args) {
  const asJson = flag(args, "--json");
  const refs = args.length ? [scenarioPaths(args[0]).ref] : listScenarioRefs();
  const results = refs.map((ref) => {
    const { contract } = loadContract(ref);
    return { ref, state: contract.state, errors: contract.errors, skips: contract.skips, fingerprint: contract.fingerprint };
  });
  const bad = results.filter((result) => result.state !== "ready");
  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      console.log(`${result.state === "ready" ? "OK  " : "FAIL"}  ${result.ref}: ${STATE_TEXT[result.state]}`);
      for (const error of result.errors) console.log(`      - ${error}`);
      for (const skip of result.skips) console.log(`      ! ${skip.kind} at line ${skip.line}: a human must approve each skipped test`);
      if (args.length && result.state === "ready" && !specWasRun(result.ref)) {
        console.log("      next: this spec is new or it changed after its last run. Review it before the run: follow review.md in the run skill.");
      }
    }
    if (!results.length) console.log("No scenarios found.");
  }
  process.exit(bad.length ? 1 : 0);
}

function cell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function commandMap(args) {
  const { paths, contract } = loadContract(args[0]);
  if (!contract.spec) fail(`No spec at ${toPosix(path.relative(process.cwd(), paths.spec))}.`);
  const rows = [];
  for (const item of contract.scenario.scenarios) {
    const test = contract.spec.tests.find((candidate) => candidate.title === item.name);
    item.expected.forEach((text, index) => {
      const step = test && test.steps.find((candidate) => candidate.id === index + 1);
      const assertions = step && step.assertions.length ? step.assertions.map((code) => "`" + cell(code) + "`").join("<br>") : "**none**";
      rows.push(`| ${cell(item.name)} | E${index + 1} | ${cell(text)} | ${assertions} |`);
    });
  }
  console.log(`### Assertion map: ${paths.ref}\n`);
  console.log("| Scenario | ID | Expected | Assertions |\n|---|---|---|---|");
  console.log(rows.join("\n"));
  console.log(`\nContract: ${STATE_TEXT[contract.state]}`);
  console.log(`Assertion fingerprint: ${contract.fingerprint}`);
  for (const skip of contract.skips) console.log(`Skipped: ${skip.kind} at line ${skip.line}`);
}

// --- run -------------------------------------------------------------------

const ANSI = /\u001b\[[0-9;]*m/g;

function firstLines(message, count = 3) {
  return String(message || "")
    .replace(ANSI, "")
    .split("\n")
    .map((line) => line.replace(/[─-╿]/g, "").trim())
    .filter(Boolean)
    .slice(0, count)
    .join(" / ");
}

function collectSpecs(suites, into = []) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) into.push(spec);
    collectSpecs(suite.suites, into);
  }
  return into;
}

function expectedSteps(steps, into = []) {
  for (const step of steps || []) {
    const id = /^E(\d+):\s*([\s\S]*)$/.exec(step.title);
    if (id) into.push({ id: Number(id[1]), title: collapse(id[2]), status: step.error ? "failed" : "passed", error: step.error ? firstLines(step.error.message) : undefined });
    expectedSteps(step.steps, into);
  }
  return into;
}

/** Convert a Playwright JSON report to the result of one scenario folder. */
export function summarizeReport(report, ref, scenario) {
  const specFile = `${ref}/scenario.spec.ts`;
  const all = collectSpecs(report.suites);
  const tests = [];
  for (const spec of all.filter((item) => toPosix(item.file || "").endsWith(specFile))) {
    for (const run of spec.tests || []) {
      const last = run.results && run.results.length ? run.results[run.results.length - 1] : null;
      const steps = last ? expectedSteps(last.steps) : [];
      const declared = scenario ? scenario.scenarios.find((item) => item.name === collapse(spec.title)) : null;
      const status = run.status === "flaky" ? "flaky" : run.status === "skipped" || !last ? "skipped" : last.status === "passed" ? "passed" : "failed";
      const trace = last ? (last.attachments || []).find((item) => item.name === "trace" && item.path) : null;
      tests.push({
        title: collapse(spec.title),
        project: run.projectName || "",
        status,
        durationMs: last ? last.duration : 0,
        expectedTotal: declared ? declared.expected.length : steps.length,
        expectedPassed: steps.filter((step) => step.status === "passed").length,
        steps,
        error: last && last.error ? firstLines(last.error.message) : undefined,
        trace: trace ? trace.path : undefined,
      });
    }
  }
  const setupFailures = all
    .filter((item) => /auth\.setup\.ts$/.test(toPosix(item.file || "")))
    .flatMap((item) => item.tests || [])
    .map((run) => (run.results || []).at(-1))
    .filter((last) => last && last.status !== "passed" && last.status !== "skipped")
    .map((last) => firstLines(last.error && last.error.message));
  const globalErrors = (report.errors || []).map((error) => firstLines(error.message));
  const count = (status) => tests.filter((test) => test.status === status).length;
  return {
    tests,
    setupFailures,
    globalErrors,
    totals: { passed: count("passed"), failed: count("failed"), flaky: count("flaky"), skipped: count("skipped") },
    durationMs: report.stats ? Math.round(report.stats.duration) : tests.reduce((sum, test) => sum + test.durationMs, 0),
  };
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** The results table that the run command prints. */
export function renderResults(ref, summary, extra = {}) {
  const lines = [`### Results: ${ref}`, ""];
  if (summary.tests.length) {
    lines.push("| # | Scenario | Expected | Time | Result |", "|---|---|---|---|---|");
    summary.tests.forEach((test, index) => {
      const label = { passed: "PASS", failed: "FAIL", flaky: "FLAKY", skipped: "NOT RUN" }[test.status];
      lines.push(`| ${index + 1} | ${cell(test.title)} | ${test.expectedPassed}/${test.expectedTotal} | ${seconds(test.durationMs)} | ${label} |`);
    });
    const t = summary.totals;
    const parts = [`**${t.passed} passed**`, `**${t.failed} failed**`];
    if (t.flaky) parts.push(`**${t.flaky} flaky**`);
    if (t.skipped) parts.push(`**${t.skipped} not run**`);
    lines.push("", `${parts.join(", ")}, ${seconds(summary.durationMs)}`);
  } else {
    lines.push("No test ran.");
  }
  const problems = [];
  for (const message of summary.globalErrors) problems.push(`- Run error: ${message}`);
  for (const message of summary.setupFailures) problems.push(`- Auth setup failed: ${message}`);
  summary.tests.forEach((test, index) => {
    if (test.status === "passed") return;
    if (test.status === "skipped") {
      problems.push(`- #${index + 1} ${test.title}: not run`);
      return;
    }
    problems.push(`- #${index + 1} ${test.title}${test.status === "flaky" ? " (passed on a retry)" : ""}`);
    const failedSteps = test.steps.filter((step) => step.status === "failed");
    for (const step of failedSteps) problems.push(`  - E${step.id} ${step.title}: ${step.error}`);
    if (!failedSteps.length && test.error) {
      const reached = test.steps.length ? `after E${test.steps[test.steps.length - 1].id}` : "before E1";
      problems.push(`  - Failed ${reached}, in an action: ${test.error}`);
    }
    if (test.trace) problems.push(`  - Trace: npx playwright show-trace "${toPosix(path.relative(process.cwd(), test.trace))}"`);
  });
  if (problems.length) lines.push("", "**Failures**", ...problems);
  if (extra.notices && extra.notices.length) lines.push("", ...extra.notices.map((notice) => `> ${notice}`));
  if (extra.report) lines.push("", `Report: ${extra.report}`);
  return lines.join("\n");
}

function commandRun(args) {
  const headed = flag(args, "--headed");
  const separator = args.indexOf("--");
  const passThrough = separator === -1 ? [] : args.splice(separator).slice(1);
  const project = projectPaths();
  const { paths, scenarioText, specText, contract } = loadContract(args[0]);
  if (specText === null) fail(`No spec at ${toPosix(path.relative(project.root, paths.spec))}. Generate it first.`);
  const playwright = playwrightInfo(project.root);
  if (!playwright) fail("@playwright/test is not installed in this project.");
  if (!fs.existsSync(project.config)) fail("e2e-scenarios/playwright.config.ts is missing. Run the init command.");

  fs.mkdirSync(path.dirname(paths.record), { recursive: true });
  const reportFile = path.join(project.results, "report.json");
  const htmlDir = path.join(project.results, "html");
  fs.rmSync(reportFile, { force: true });
  const specArg = toPosix(path.relative(project.root, paths.spec));
  const command = [playwright.cli, "test", specArg, "--config", toPosix(path.relative(project.root, project.config)), "--reporter=list,json,html"];
  if (headed) command.push("--headed");
  command.push(...passThrough);
  const child = spawnSync(process.execPath, command, {
    cwd: project.root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile, PLAYWRIGHT_HTML_OUTPUT_DIR: htmlDir, PLAYWRIGHT_HTML_OPEN: "never", FORCE_COLOR: "0" },
  });
  const output = `${child.stdout || ""}${child.stderr || ""}`;
  fs.writeFileSync(path.join(project.results, "last-output.log"), output);

  const reportText = readText(reportFile);
  if (reportText === null) {
    console.log(`### Results: ${paths.ref}\n\nPlaywright wrote no report. The run did not start.\n`);
    console.log(output.replace(ANSI, "").trim().split("\n").slice(-30).join("\n"));
    process.exit(2);
  }
  const summary = summarizeReport(JSON.parse(reportText), paths.ref, contract.scenario);
  const previous = readText(paths.record);
  const notices = [];
  if (contract.state !== "ready") {
    notices.push(`Contract: ${STATE_TEXT[contract.state]}. These results do not show that the scenario is covered.`);
    for (const error of contract.errors) notices.push(`- ${error}`);
  }
  for (const skip of contract.skips) notices.push(`Skipped test: ${skip.kind} at line ${skip.line}. A human must approve each skipped test.`);
  if (previous) {
    const before = JSON.parse(previous);
    if (before.assertionFingerprint && before.assertionFingerprint !== contract.fingerprint) {
      notices.push("The assertions changed after the previous run. Show the assertion map to the human.");
    }
  }
  const record = {
    scenario: paths.ref,
    at: new Date().toISOString(),
    playwright: playwright.version,
    headed,
    contract: contract.state,
    scenarioHash: hashScenario(scenarioText),
    specHash: createHash("sha256").update(specText).digest("hex"),
    assertionFingerprint: contract.fingerprint,
    durationMs: summary.durationMs,
    totals: summary.totals,
    tests: summary.tests,
    setupFailures: summary.setupFailures,
    globalErrors: summary.globalErrors,
  };
  fs.writeFileSync(paths.record, JSON.stringify(record, null, 2) + "\n");
  fs.appendFileSync(
    path.join(project.results, "history.jsonl"),
    JSON.stringify({ scenario: record.scenario, at: record.at, contract: record.contract, totals: record.totals, durationMs: record.durationMs }) + "\n",
  );
  console.log(renderResults(paths.ref, summary, { notices, report: toPosix(path.relative(project.root, path.join(htmlDir, "index.html"))) }));
  const failed = summary.totals.failed || summary.totals.flaky || summary.globalErrors.length || summary.setupFailures.length || !summary.tests.length || summary.totals.skipped;
  process.exit(failed ? 1 : 0);
}

// --- status ----------------------------------------------------------------

function kebab(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Read the feature catalog. A catalog from an earlier version has no Path column. */
export function parseCoverage(text) {
  const rows = [];
  let columns = null;
  for (const line of text.split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((item) => item.trim());
    if (cells.every((item) => /^:?-+:?$/.test(item))) continue;
    if (!columns) {
      columns = cells.map((item) => item.toLowerCase());
      continue;
    }
    const get = (name) => (columns.includes(name) ? cells[columns.indexOf(name)] || "" : "");
    const feature = get("feature").replace(/\*\*/g, "");
    if (!feature) continue;
    let ref = get("path").replace(/`/g, "");
    if (!ref) {
      const parts = feature.split(/\s+-\s+/);
      ref = parts.length > 1 ? `${kebab(parts[0])}/${kebab(parts.slice(1).join("-"))}` : kebab(feature);
    }
    rows.push({ feature, description: get("description"), ref });
  }
  return rows;
}

function localTime(iso) {
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Build one dashboard row for each feature and each scenario folder. */
export function buildStatus(root = process.cwd()) {
  const paths = projectPaths(root);
  const coverageText = readText(paths.coverage);
  const catalog = coverageText === null ? [] : parseCoverage(coverageText);
  const refs = listScenarioRefs(root);
  const rows = [];
  const describe = (ref, feature, description) => {
    const item = scenarioPaths(ref, root);
    const scenarioText = readText(item.scenario);
    if (scenarioText === null) {
      return { feature, description, ref, scenarios: 0, state: "not-covered", errors: [], skipped: 0, findings: 0, lastRun: null, next: `/e2e:build ${ref}` };
    }
    const specText = readText(item.spec);
    const contract = checkContract(scenarioText, specText);
    const findingsText = readText(item.findings) || "";
    const recordText = readText(item.record);
    let lastRun = null;
    if (recordText) {
      const record = JSON.parse(recordText);
      const total = record.tests.length;
      lastRun = {
        at: record.at,
        passed: record.totals.passed,
        total,
        ok: total > 0 && record.totals.passed === total && !record.setupFailures.length && !record.globalErrors.length,
        flaky: record.totals.flaky,
        specChanged: specText !== null && record.specHash !== createHash("sha256").update(specText).digest("hex"),
      };
    }
    const next =
      contract.state === "scenario-only" ? `/e2e:run ${ref}` : contract.state === "ready" ? `/e2e:run ${ref}` : `/e2e:run ${ref} --regenerate`;
    return {
      feature,
      description,
      ref,
      scenarios: contract.scenario.scenarios.length,
      state: contract.state,
      errors: contract.errors,
      skipped: contract.skips.length,
      findings: (findingsText.match(/^\s*- \[ \]/gm) || []).length,
      lastRun,
      next,
    };
  };
  const seen = new Set();
  for (const entry of catalog) {
    seen.add(entry.ref);
    rows.push(describe(entry.ref, entry.feature, entry.description));
  }
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    const title = parseScenario(readText(scenarioPaths(ref, root).scenario)).title || ref;
    rows.push(describe(ref, title, ""));
  }
  return { hasCatalog: coverageText !== null, rows };
}

const STATE_LABEL = {
  "not-covered": "Not covered",
  "scenario-only": "Scenario only",
  legacy: "Spec has no contract",
  stale: "Spec stale",
  gap: "Contract gap",
  ready: "Spec ready",
};

export function renderStatus(status) {
  const lines = ["## E2E Dashboard", ""];
  if (!status.rows.length) {
    lines.push("No features and no scenarios found.", "", "Next: `/e2e:explore` to catalog the features, or `/e2e:build <area>/<scenario>` to write a scenario.");
    return lines.join("\n");
  }
  lines.push("| Feature | Path | Scenarios | Spec | Last run | Open findings | Next action |", "|---|---|---|---|---|---|---|");
  for (const row of status.rows) {
    const feature = row.description ? `**${cell(row.feature)}**: ${cell(row.description)}` : `**${cell(row.feature)}**`;
    let spec = STATE_LABEL[row.state];
    if (row.skipped) spec += `, ${row.skipped} skipped`;
    let last = "none";
    if (row.lastRun) {
      last = `${row.lastRun.ok ? "PASS" : "FAIL"} ${row.lastRun.passed}/${row.lastRun.total}, ${localTime(row.lastRun.at)}`;
      if (row.lastRun.flaky) last += ", flaky";
      if (row.lastRun.specChanged) last += ", spec changed after this run";
    }
    lines.push(`| ${feature} | \`${row.ref}\` | ${row.scenarios || "none"} | ${spec} | ${last} | ${row.findings || "none"} | \`${row.next}\` |`);
  }
  const count = (state) => status.rows.filter((row) => row.state === state).length;
  const attention = count("stale") + count("gap") + count("legacy");
  const failing = status.rows.filter((row) => row.lastRun && !row.lastRun.ok).length;
  lines.push(
    "",
    `**Total:** ${status.rows.length} features. ${count("ready")} spec ready, ${count("scenario-only")} scenario only, ${count("not-covered")} not covered, ${attention} need regeneration, ${failing} failed on the last run.`,
  );
  if (!status.hasCatalog) lines.push("", "No `COVERAGE.md`. Run `/e2e:explore` to find features that have no scenario.");
  return lines.join("\n");
}

function commandStatus(args) {
  const status = buildStatus();
  console.log(flag(args, "--json") ? JSON.stringify(status, null, 2) : renderStatus(status));
}

const HELP = `Usage: node e2e.mjs <command>

  init [--auth scripted|manual|none] [--base-url <url>] [--replace-config]
                                Create the files in e2e-scenarios/ that are missing
  preflight [--json]            Check Playwright, the config, the application, and auth
  hash <area>/<scenario>        Print the contract hash of scenario.md
  check [<area>/<scenario>] [--json]
                                Check each spec against its scenario
  map <area>/<scenario>         Print each Expected item with its assertions
  run <area>/<scenario> [--headed] [-- <playwright args>]
                                Run one spec, write the evidence, print the results
  status [--json]               Print the dashboard`;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "init":
      return commandInit(args);
    case "preflight":
      return commandPreflight(args);
    case "hash":
      return commandHash(args);
    case "check":
      return commandCheck(args);
    case "map":
      return commandMap(args);
    case "run":
      return commandRun(args);
    case "status":
      return commandStatus(args);
    default:
      console.log(HELP);
      process.exit(command && command !== "help" && command !== "--help" ? 2 : 0);
  }
}

const invoked = process.argv[1] ? fs.realpathSync(path.resolve(process.argv[1])) : "";
if (invoked.toLowerCase() === fs.realpathSync(fileURLToPath(import.meta.url)).toLowerCase()) {
  main().catch((error) => {
    console.error(error instanceof UserError ? `e2e: ${error.message}` : error.stack || String(error));
    process.exit(2);
  });
}
