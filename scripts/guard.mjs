#!/usr/bin/env node
// PreToolUse hook of the e2e plugin, for the Edit, Write, and Read tools.
// It asks the human before an edit changes what an established spec proves,
// and before an agent reads the credentials file or the saved session.
// An edit to actions, to a new spec, or to a spec of a changed scenario passes with no question.
// The hook fails open: on each error it lets the tool call continue.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertionChanges, hashScenario } from "./e2e.mjs";

const SPEC = /[\\/]e2e-scenarios[\\/](.+)[\\/]scenario\.spec\.ts$/;
const SECRET = /[\\/]e2e-scenarios[\\/](\.env|\.auth[\\/]state\.json)$/;

const SECRET_REASON = [
  "e2e contract: this file holds the test credentials or a signed-in session.",
  "No step of the e2e plugin needs an agent to read it. The setup test reads it when Playwright runs.",
  "To see if the credentials are set, the preflight command of the helper script shows the names only.",
  "Approve only if you want the content of this file in the conversation.",
].join("\n");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/** A spec is established when a human can have seen it: it has a run record, or git tracks it. */
function isEstablished(file, ref) {
  const scenariosDir = file.slice(0, file.length - `${ref}/scenario.spec.ts`.length - 1);
  const record = path.join(scenariosDir, ".results", "runs", ref.replace(/[\\/]/g, "__") + ".json");
  if (fs.existsSync(record)) return true;
  const git = spawnSync("git", ["-C", path.dirname(file), "ls-files", "--error-unmatch", "--", path.basename(file)], {
    stdio: "ignore",
    timeout: 3000,
  });
  return git.status === 0;
}

/** The content of the file after the tool call, or null when it cannot be known. */
function contentAfter(input, before) {
  const tool = input.tool_input || {};
  if (input.tool_name === "Write") return typeof tool.content === "string" ? tool.content : null;
  if (input.tool_name !== "Edit" || typeof tool.old_string !== "string" || typeof tool.new_string !== "string") return null;
  if (!tool.old_string || !before.includes(tool.old_string)) return null;
  return tool.replace_all ? before.split(tool.old_string).join(tool.new_string) : before.replace(tool.old_string, () => tool.new_string);
}

function decide(input) {
  const file = input.tool_input && input.tool_input.file_path;
  if (input.tool_name === "Read") return typeof file === "string" && SECRET.test(file) ? SECRET_REASON : null;
  const match = typeof file === "string" ? SPEC.exec(file) : null;
  if (!match || !fs.existsSync(file)) return null;
  const ref = match[1].split(/[\\/]/).join("/");
  const before = fs.readFileSync(file, "utf8");
  const after = contentAfter(input, before);
  if (after === null) return null;

  const diff = assertionChanges(before, after);
  if (!diff.beforeHash) return null; // A spec with no contract header.
  const scenarioFile = path.join(path.dirname(file), "scenario.md");
  if (!fs.existsSync(scenarioFile)) return null;
  // The scenario changed after generation, thus new assertions are expected.
  if (hashScenario(fs.readFileSync(scenarioFile, "utf8")) !== diff.beforeHash) return null;
  if (!diff.changes.length && !diff.skips.length) return null;
  if (!isEstablished(file, ref)) return null;

  const lines = [`e2e contract: this edit changes what the test of ${ref} proves, and scenario.md did not change.`];
  for (const change of diff.changes.slice(0, 6)) {
    lines.push(`- "${change.test}" E${change.id}`, `    before: ${change.before}`, `    after:  ${change.after}`);
  }
  if (diff.changes.length > 6) lines.push(`- and ${diff.changes.length - 6} more changed steps`);
  for (const skip of diff.skips) lines.push(`- adds ${skip.kind} at line ${skip.line}: the test will not run`);
  lines.push(
    "Approve only if the new version is what the scenario requires.",
    "If the application does not do what the scenario says, deny this edit. Then decide: a defect in the application, or a scenario to update with /e2e:build.",
  );
  return lines.join("\n");
}

try {
  const reason = decide(JSON.parse(readStdin() || "{}"));
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: reason },
      }),
    );
  }
} catch {
  // Fail open.
}
process.exit(0);
