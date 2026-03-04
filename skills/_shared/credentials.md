# Managing Credentials

**To update credentials:**

- **Keychain method:** Delete credentials and re-run:
  ```bash
  # Use your OS credential manager to delete "e2e-credentials" entry, or:
  rm e2e-scenarios/.auth/method.txt
  /e2e:run <scenario>  # Will prompt for new credentials
  ```
- **Env method:** Edit `e2e-scenarios/.env` directly
- **Manual method:** No credentials stored

**To switch credential methods:**

```bash
# Delete current method and state
rm e2e-scenarios/.auth/method.txt
rm e2e-scenarios/.auth/state.json
rm e2e-scenarios/.env  # If using env method

# Run any test - you'll be prompted to choose a new method
/e2e:run <scenario>
```

**To delete all auth data:**

```bash
rm -rf e2e-scenarios/.auth
rm e2e-scenarios/.env
```
