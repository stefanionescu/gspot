---
title: Documentation Review
---

# Documentation Review

The review an agent runs over changed documentation before the checks of the repository, and the
definition of done. The other documentation rules say how to write each part; this file says how
to read the result.

## Review against the source

Check every claim against the implementation or another authoritative source, not against memory:

- Commands, flags, fields, labels, outputs, defaults, and supported versions are exact and
  current.
- Permissions, limitations, and risks are visible before the step that needs them.
- Examples run as written and are safe to run.
- The page describes the present behavior and promises nothing about the future.

## Review as the reader

Read the page as its intended reader, from the top:

- The reader can tell whether the project fits, and reach the first useful result.
- Prerequisites come before the procedure, and each task has one outcome.
- Each step says whether it is required or optional, and what the reader sees after it.
- Risky work has a way back.

## Definition of done

Documentation work is done when the content has a clear owner and audience, every claim rests on
an authoritative source, and the procedures are complete and in order. Related pages stay
consistent, and no stale, duplicated, or placeholder content remains. Never publish an empty
heading, placeholder prose, or a checklist as content.
