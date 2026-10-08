---
title: Documentation
---

# Documentation

Read the implementation and existing pages before writing. Identify the reader, their task,
starting state, permissions, and risks. Describe the supported behavior, not a proposed feature.

## Ownership

Durable product information has one documentation owner, not only a chat, review, issue, or commit.
Link to that owner instead of copying large procedures or configuration tables. When behavior
changes, update its reference, examples, and intentional short copies in the same change.

Keep the shortest successful path in the README and move specialist tasks into linked guides.
Document real subproject boundaries, not every directory. Do not add directory trees or file
inventories; describe behavior and mention a path only when the reader must use it.

## Topic choices

<!-- level: all -->

Give each page one main purpose. Separate learning tutorials, goal-focused procedures, lookup
reference, and explanations of the model. A troubleshooting page starts with what the reader
observes and leads through diagnosis before destructive recovery.

State limitations that rule out use before setup. Keep permissions, prerequisites, verification,
and recovery in the procedure that needs them. Remove obsolete content; versioned documentation
owns an older contract. Never ship placeholders or private review notes as product guidance.

## References

See [Diátaxis](https://diataxis.fr/) for topic design and
[Write the Docs guidance](https://www.writethedocs.org/guide/writing/beginners-guide-to-docs/)
for planning a documentation set.
