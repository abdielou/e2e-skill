---
type: llm
focus: last_message
weight: 2
---

PASS if the reply does both of these:
1. It shows a draft of a scenario file with a "Scenario:" heading and a numbered list of expected results.
2. It asks the user to approve the draft or to request changes, and it does not say that the file is written.

FAIL if the reply says that the scenario file was written or saved.
FAIL if the reply has no draft.
