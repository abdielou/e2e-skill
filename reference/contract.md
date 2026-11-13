# The Scenario Contract

The human approves `scenario.md`. The agent writes and repairs `scenario.spec.ts`.
The spec must prove each `Expected` item of the scenario. A spec that passes but proves less is a defect.

## Who owns what

| Item | Owner | When the agent can change it |
|------|-------|------------------------------|
| `scenario.md` | Human | Only in `/e2e:build`, after the human approves the draft |
| Expected steps in the spec: the step titles and their assertions | Human | Only after the human approves each change |
| Actions in the spec: navigation, clicks, input, waits, test data | Agent | At any time |
| `auth.setup.ts`, `seed.spec.ts` | Agent | At any time |
| `e2e-scenarios/.env`, `e2e-scenarios/.auth/state.json` | Human | Never. The agent does not read these files |

## Rules for a spec

1. One `## Scenario:` gives one `test`. The test title is the scenario name.
2. One `Expected` item gives one `test.step`. The step title is `E<n>: <text of the item>`, copied without changes.
3. Each Expected step has one assertion or more. The assertions must prove the full text of the item.
4. The spec header has the scenario path and the contract hash. Get the hash from the helper script.
5. Tests are independent. Each test gets a new page and starts at `/`.
6. Navigate through the UI of the application. Use `page.goto` only for `/`.
7. Put test data in named constants at the top of the spec.
8. Do not use `waitForTimeout`, `networkidle`, `page.pause()`, or `test.only`.

The helper script checks rules 1 to 4 and rule 8. Run its `check` command after each change to a spec.

## Rules for the agent

1. **A failed test can be the correct result.** If the application does not do what an `Expected` item says, the test must fail. Report it. Do not change the expectation to get a pass.
2. **A change to an assertion needs approval.** Show the assertion before and after. Ask the human. Then edit. The plugin also stops such an edit and shows it to the human. If the edit is denied, do not make the change in a different way.
3. **A skipped test needs approval.** Do not add `test.skip`, `test.fixme`, or `test.fail` unless the human made that decision in this conversation.
4. **Do not touch credentials.** Do not read `.env` or `.auth/state.json`. Do not type a password with the browser CLI. Do not ask for a password in the conversation.
5. **Do not start the application.** If it does not answer, tell the human and stop.
6. **Do not create a Node project in `e2e-scenarios/`.** No `package.json`, `tsconfig.json`, or `node_modules` there.

## Thoughts that mean stop

| Thought | Fact |
|---------|------|
| "The text in the application changed, so the test is out of date." | Only the human knows if that change was intended. Ask. |
| "A looser matcher makes the test stable." | A looser matcher proves less. That is an assertion change. Ask. |
| "The user asked for a green run." | The user needs a true result. A false PASS is worse than a FAIL. |
| "I will mark it `fixme` and say so in the report." | A skipped test hides a failure in each later run. Ask first. |
| "The scenario is wrong, I will correct it." | The scenario is the approved contract. Report the problem. The human corrects it in `/e2e:build`. |
| "It is faster to read `.env`." | The password then stays in the transcript. The setup project logs in without it. |
