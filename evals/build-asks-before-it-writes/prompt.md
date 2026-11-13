---
description: The agent drafts a scenario. It must show the draft and get approval before it writes the file.
tags: [contract]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Agent, AskUserQuestion]
---

Add an e2e scenario for our notes feature. When a user adds a note, a message "Note added" appears and the note shows in the notes list. When the note is empty, the page shows "Note text is required".
