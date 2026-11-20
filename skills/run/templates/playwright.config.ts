// Created by the e2e plugin. Change the base URL and the auth mode in e2e.config.json.
import { defineConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
/*E2E_IMPORTS*/
/*E2E_HERE*/

// Load e2e-scenarios/.env. A variable that is already set keeps its value.
const envPath = path.join(here, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)$/);
    if (match) process.env[match[1]] ??= match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}

const settings = JSON.parse(fs.readFileSync(path.join(here, "e2e.config.json"), "utf-8"));
const baseURL = process.env.E2E_BASE_URL || settings.baseURL || "http://localhost:3000";
const results = path.join(here, ".results");
const authFile = path.join(here, ".auth", "state.json");

// scripted: the setup project logs in before each run and writes the auth state.
// manual:   a human logs in one time. The saved auth state is used again.
// none:     the application has no login.
const scripted = settings.auth === "scripted";
const storageState = scripted || (settings.auth === "manual" && fs.existsSync(authFile)) ? authFile : undefined;
const dependencies = scripted ? ["setup"] : [];

export default defineConfig({
  testDir: here,
  outputDir: path.join(results, "artifacts"),
  // One worker, because scenarios can use the same application data.
  workers: 1,
  // No retries, because a flaky test must show as a failure.
  retries: 0,
  timeout: 60_000,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(results, "report.json") }],
    ["html", { outputFolder: path.join(results, "html"), open: "never" }],
  ],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    // The setup project types the password. It must not record a trace or a screenshot.
    ...(scripted
      ? [{ name: "setup", testMatch: /auth\.setup\.ts$/, use: { trace: "off" as const, screenshot: "off" as const } }]
      : []),
    { name: "e2e", testMatch: /scenario\.spec\.ts$/, dependencies, use: { storageState } },
    { name: "seed", testMatch: /seed\.spec\.ts$/, dependencies, use: { storageState } },
  ],
});
