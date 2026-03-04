# Model Profiles

The e2e skill uses a **model profile** to control which AI model is used for subagent tasks (codebase scanning, spec review, etc.). The profile is stored in `e2e-scenarios/.config/model-profile.txt`.

## Available Profiles

| Mode | Optimized | Quality | Economy |
|------|-----------|---------|---------|
| Explore (subagents) | sonnet | opus | sonnet |
| Build (main agent) | opus | opus | sonnet |
| Run — new spec (main + subagents) | opus | opus | sonnet |
| Run — existing spec (main agent) | haiku | opus | haiku |

- **Optimized** — Best model for each job. Sonnet scans, Opus authors, Haiku runs existing specs. Good balance of quality and cost.
- **Quality** — Opus for everything. Highest quality, highest cost.
- **Economy** — Sonnet + Haiku. Lowest cost, still capable.

## What the profile controls

- **Subagent models** (directly controlled): When spawning Task subagents (Explore for codebase scanning, general-purpose for spec review), the agent sets the `model` parameter based on the active profile.
- **Main agent model** (advisory): The main agent's model is set at the session level by the user. The profile prints a recommendation so the user knows which model to set (e.g., "Tip: set your session model to haiku for running existing specs").

---

## Phase -2: Model Profile Check

**Run this phase first** on every invocation (explore, build, or run). Use a simple Bash command to check for the config file — do not read files unnecessarily.

**1. Check if a profile has been chosen:**

```bash
cat e2e-scenarios/.config/model-profile.txt 2>/dev/null
```

**2. If the file exists and contains a valid profile** (`optimized`, `quality`, or `economy`):

- Store the profile name in memory for this session
- Continue to the next phase silently (no output to user)

**3. If the file does NOT exist or is invalid:**

Use **AskUserQuestion** to prompt:

```
No model profile configured. Which profile should the e2e skill use?
```

**Options:**

**Option A: Optimized (Recommended)**
- **Label:** "Optimized (Recommended)"
- **Description:** "Best model for each job — Sonnet scans, Opus authors, Haiku runs existing specs."

**Option B: Quality**
- **Label:** "Quality"
- **Description:** "Opus for everything. Highest quality, highest cost."

**Option C: Economy**
- **Label:** "Economy"
- **Description:** "Sonnet + Haiku only. Lowest cost, still capable."

**4. Save the profile:**

```bash
mkdir -p e2e-scenarios/.config
```

Write the chosen profile (`optimized`, `quality`, or `economy`) to `e2e-scenarios/.config/model-profile.txt`.

**5. Print a model recommendation based on the current mode:**

After the profile is set (either loaded or just chosen), print a tip based on what mode the user invoked:

| Mode invoked | Optimized tip | Quality tip | Economy tip |
|-------------|---------------|-------------|-------------|
| `explore` | "Tip: Sonnet is ideal for this. Run `/model sonnet` if needed." | "Tip: Opus is used for quality profile." | "Tip: Sonnet is ideal for this. Run `/model sonnet` if needed." |
| `build` | "Tip: Opus is ideal for authoring. Run `/model opus` if needed." | "Tip: Opus is used for quality profile." | "Tip: Sonnet handles this well." |
| `run` (new spec) | "Tip: Opus is ideal for spec generation. Run `/model opus` if needed." | "Tip: Opus is used for quality profile." | "Tip: Sonnet handles this well." |
| `run` (existing spec) | "Tip: This just runs an existing spec — Haiku is plenty. Run `/model haiku` if needed." | "Tip: Opus is used for quality profile." | "Tip: This just runs an existing spec — Haiku is plenty. Run `/model haiku` if needed." |
| Dashboard | No tip needed (read-only) | No tip needed | No tip needed |

Only print the tip when the profile is **first created**. On subsequent runs where the config already exists, skip the tip to avoid noise.

**6. Model lookup for subagents:**

When spawning Task subagents later in the workflow, use this mapping to set the `model` parameter:

| Subagent context | Optimized | Quality | Economy |
|-----------------|-----------|---------|---------|
| Explore mode — codebase scan (Step 3) | `sonnet` | `opus` | `sonnet` |
| Run mode — Phase 3 codebase research | `sonnet` | `opus` | `sonnet` |
| Run mode — Phase 5.5 spec review | `haiku` | `opus` | `haiku` |
