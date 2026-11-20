# Triage a Failed Run

A failed test is information. Find the cause first. The cause decides who can make the change.
`e2e` is the helper script command from `SKILL.md`. `<path>` is `<area>/<scenario>`.

**Do not edit a file before you know the cause.**

## 1. Collect the evidence

1. Read the output of `e2e run <path>`. It shows the Expected item or the action that failed, and the error.
2. If the cause is not clear, examine the trace of the failed test:

   ```bash
   npx playwright trace open <trace.zip>
   npx playwright trace actions
   npx playwright trace errors
   npx playwright trace close
   ```
3. If you must see the live page, debug the test. Start this command **in the background**:

   ```bash
   npx playwright test e2e-scenarios/<path>/scenario.spec.ts --config e2e-scenarios/playwright.config.ts --project=e2e --no-deps -g "<test title>" --debug=cli
   ```
   When the output shows `playwright-cli attach tw-<id>`:

   ```bash
   npx playwright cli attach tw-<id>
   npx playwright cli -s=tw-<id> pause-at scenario.spec.ts:<line>    # the file name with no folder
   npx playwright cli -s=tw-<id> snapshot
   npx playwright cli -s=tw-<id> console
   npx playwright cli -s=tw-<id> resume                              # to end the session
   ```
   End each debug session with `resume`. A paused test stays open as a process until then.

## 2. Find the cause

| Cause | Signs | Who decides | What you do |
|-------|-------|-------------|-------------|
| **Environment** | The application does not answer. The auth setup failed. The page is the login page. Test data is missing. A browser is not installed | Agent | Correct the environment, or tell the human what to correct. Do not change the spec. Run again |
| **Action drift** | An action fails: a locator is not found, or a page is not ready. The application still does what the scenario describes | Agent | Repair the actions. Do the flow with the browser CLI and use the code that it prints. Do not change an Expected step |
| **Assertion drift** | An Expected step fails, but the page shows the result that the Expected text states. Example: the element has a new role | Human | Show the assertion before and after. Ask with **AskUserQuestion**. Edit only after approval. If the plugin hook is installed, it shows the edit to the human one more time |
| **Behavior change** | The page does not show the result that the Expected text states | Human | Stop. Do not edit the spec. Do not edit the scenario. Report as in section 3 |

If you cannot tell assertion drift from behavior change, it is a behavior change.

If a browser is not installed, tell the human to run `npx playwright install chromium`. Do not run it yourself. It downloads a large file, and it can remove browser builds that other projects use.

For an expired session in the manual auth mode, do the manual login procedure in `setup.md`.

## 3. Report a behavior change

Tell the human these five facts:

1. The scenario name and the Expected item, for example `E2`.
2. The Expected text, copied from `scenario.md`.
3. What the application does. Quote the text on the page or give the URL.
4. The evidence: the trace path and the report path.
5. The question: "Is this a defect in the application, or an intended change?"

Then do what the human decides:

| Decision | Action |
|----------|--------|
| It is a defect | Leave the test as it is. It must fail until the defect is corrected. Add a line to `findings.md`. If the human asks for it, mark the test `test.fixme` with the ticket number in a comment |
| It is an intended change | The human updates the scenario with `/e2e:build`. Then generate the spec again |

## 4. Repair rules

- Repair one failure at a time. After each repair, run `e2e check <path>` and `e2e run <path>`.
- Before the first repair and after the last repair, run `e2e map <path>`. The assertion fingerprint must be the same, unless the human approved an assertion change.
- Do a maximum of three repair rounds. Then stop and report what you found.
- A repair must not add `waitForTimeout`, `networkidle`, a longer timeout on an assertion, `test.skip`, `test.fixme`, or `test.fail`.
- Tell the human which lines you changed.

## Thoughts that mean stop

| Thought | Fact |
|---------|------|
| "I will change the expected text to the text that the page shows." | That hides a possible defect. It is a behavior change. Ask. |
| "The assertion is too strict." | The scenario sets how strict it is. The human approved the scenario. |
| "This is the third round, a `fixme` unblocks the run." | Stop and report. A skip needs a human decision. |
| "The user is in a hurry." | A false PASS costs more time than a question. |
