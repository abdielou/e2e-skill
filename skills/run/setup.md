# Setup and Authentication

Do this when `e2e preflight` reports a missing project file, missing credentials, or a missing auth state.
`e2e` is the helper script command from `SKILL.md`.

## Project files

1. If `e2e-scenarios/e2e.config.json` does not exist, ask the human two questions with **AskUserQuestion**:
   - The base URL of the running application. The default is `http://localhost:3000`.
   - How the application handles login:

     | Option | Use it when | Result |
     |--------|-------------|--------|
     | Scripted login (Recommended) | The login is a form with a user name and a password | A setup test logs in before each run. It works in CI |
     | Manual login | The login uses SSO, MFA, or a CAPTCHA | The human logs in one time in a browser window. The session is saved and used again |
     | No login | The application has no login | No auth step |
2. Run `e2e init --auth <scripted|manual|none> --base-url <url>`. It creates the files that are missing. It does not replace a file.
3. Run `e2e preflight` again.

## Scripted login

The password must not go into this conversation. The setup test reads it from the environment.

1. Tell the human to copy `e2e-scenarios/.env.example` to `e2e-scenarios/.env` and to set `E2E_USERNAME` and `E2E_PASSWORD` there. Do not ask for the values. Do not read `.env`. Continue when `e2e preflight` shows that the credentials are set.
2. Find the locators of the login form. Do not fill the form.

   ```bash
   npx playwright cli open <base URL>
   npx playwright cli snapshot
   npx playwright cli --raw generate-locator <ref>    # one time for each of: user name field, password field, submit button
   npx playwright cli close
   ```
3. Edit `e2e-scenarios/auth.setup.ts`. Replace the three locators. Remove the `TODO(e2e)` lines. If the login has two pages, add the steps in the correct sequence.
4. Run the setup test:

   ```bash
   npx playwright test --config e2e-scenarios/playwright.config.ts --project=setup
   ```
   - If it passes, `e2e-scenarios/.auth/state.json` exists and setup is complete.
   - If a locator is not found, correct the locator and run it again.
   - If the form stays on the login page, the application rejected the login. Tell the human to check the values in `.env`.
5. The default check after login is "the password field is hidden". When you later see a signed-in page, replace it with an element that only a signed-in user sees.

## Manual login

1. Open a visible browser: `npx playwright cli open <base URL> --headed`.
2. Ask the human with **AskUserQuestion** to log in in that window and then to confirm.
3. Run `npx playwright cli snapshot`. If the page is the login page, ask again.
4. Save the session and close the browser:

   ```bash
   npx playwright cli state-save e2e-scenarios/.auth/state.json
   npx playwright cli close
   ```

The saved session expires. When a run shows the login page, do this procedure again and run the spec again.

## A missing browser

If the setup test says that a browser executable is missing, tell the human to run `npx playwright install chromium`. Do not run it yourself. Then stop.

## Projects from plugin version 2

| Version 2 item | Action |
|----------------|--------|
| `playwright.config.ts` without `e2e.config.json` | Run `e2e init --auth <mode> --base-url <url> --replace-config`. The old file moves to `playwright.config.ts.v2.bak` |
| `.auth/method.txt` | Not used. The human can delete it |
| Credentials in the system keychain (`keytar`) | Not used. The human can delete the `e2e-credentials` entry |
| Specs with a shared page and no contract header | They still run. Generate each one again with `/e2e:run <path> --regenerate` |
| `COVERAGE.md` without a `Path` column | It still works. `/e2e:explore` adds the column |
