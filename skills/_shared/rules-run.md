# Run Mode Rules

10. **Handle auth gracefully** — Detect login screens and authenticate automatically (or ask user for manual auth)
11. **Record only clean steps** — Mistakes and retries should not appear in the generated spec
12. **Prefer stable selectors** — Use `data-testid` whenever available. Follow the selector priority order.
13. **Use the codebase** — Read source files to find the best selectors before interacting
14. **Be descriptive** — Each step in the spec should have a comment explaining what it does
15. **Handle dynamic data** — Use `.first()` for "any available" selections; note the pattern, not the specific value
16. **Extract test data as constants** — Place all environment-specific values (entity names, categories, dropdown options, etc.) in a clearly labeled constants block at the top of the spec file. Never inline these values in test steps. This lets QA testers reconfigure tests for different environments by editing one block.
17. **Navigate through the UI, not URLs** — The only `page.goto()` allowed is `page.goto("/")` in `beforeAll` to enter the app. All other navigation must use the app's own UI: sidebar links, menu items, breadcrumbs, buttons, etc. This tests real user navigation paths and catches broken links, missing menu items, and routing issues that URL-based navigation would skip.
18. **Fixtures are colocated** — When a test needs file uploads or imports (CSV, PNG, PDF, etc.), generate the fixture file and save it in the same scenario folder as the spec. Reference fixtures via `path.join(__dirname, '<filename>')`. Keep fixtures minimal and deterministic.
19. **Avoid `waitForTimeout`** — Never use `page.waitForTimeout()` for waiting on data loads or navigation. Instead use assertion-based waits (`await expect(locator).toBeVisible()`), `waitForURL()`, `waitForLoadState('networkidle')`, or `waitForResponse()`. Fixed timeouts are either too slow or too flaky.
20. **CRITICAL: Verify navigation before proceeding** — After ANY action that triggers navigation or page transition:

    - Wait for a unique element on the NEW page/step to appear before continuing
    - Never click the same button twice without confirming the first click succeeded
    - For wizards: wait for the step indicator to change, or a unique element of the next step
    - Use `waitForSelector`, `waitForURL`, or assertions like `expect(locator).toBeVisible()` in the generated spec

    **Example - BAD (no wait):**

    ```typescript
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click(); // May click same button twice!
    ```

    **Example - GOOD (wait for navigation):**

    ```typescript
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 2: Details")).toBeVisible(); // Confirm we're on step 2
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 3: Review")).toBeVisible(); // Confirm we're on step 3
    ```

21. **NEVER use Playwright Inspector or debugging tools** — Do NOT:
    - Use `--debug`, `--ui`, or `--headed --debug` flags when running tests
    - Add `page.pause()` to generated test code
    - Open the Playwright Inspector manually
    - Use any debugging or inspection tools during test execution
    - **Exploration (Phase 4):** Use **Playwright MCP tools only** (browser_navigate, browser_click, etc.)
    - **Running tests (Phase 0, 6):** Use **`npx playwright test`** with `--headed` for visibility OR headless for speed, but NEVER with `--debug`

## Limitations

- Defaults to `http://localhost:3000`. Set `E2E_BASE_URL` in `e2e-scenarios/.env` to target a different URL.
- Auth state may expire — with stored credentials, re-authentication happens automatically; with manual mode, you'll be prompted to log in again
- Generated specs are a starting point — complex flows may need manual tuning
- Dynamic data (IDs, timestamps) uses flexible matchers but may still cause flaky tests
- Max 3 fix attempts during validation — after that, manual intervention is needed
- Automated login requires consistent login form structure (standard email/password fields)
