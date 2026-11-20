// Created by the e2e plugin. This file logs in before each run.
// The credentials come from the environment. Do not write them in this file.
// For an agent: do not read or search e2e-scenarios/.env. This file needs only the two variable names below.
import { test as setup, expect } from "@playwright/test";
import * as path from "path";

setup("authenticate", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error("Set E2E_USERNAME and E2E_PASSWORD in e2e-scenarios/.env or in the environment.");
  }

  await page.goto("/");

  // TODO(e2e): replace these three locators with the locators of the login form.
  await page.getByLabel("Email").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // TODO(e2e): replace this check with an element that only a signed-in user sees.
  await expect(page.getByLabel("Password")).toBeHidden();

  const authFile = path.join(path.dirname(setup.info().file), ".auth", "state.json");
  await page.context().storageState({ path: authFile });
});
