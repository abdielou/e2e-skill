// Created by the e2e plugin.
// The seed puts the page in the state where each scenario starts.
// The agent starts this test in debug mode to examine the application.
import { test } from "@playwright/test";

test("seed", async ({ page }) => {
  await page.goto("/");
});
