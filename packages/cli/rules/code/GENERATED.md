---
title: Generated Code
---

# Generated Code

- A generated file is never edited by hand. Change the source or the generator and regenerate
  through the owning command.
- Identify generated ownership explicitly. Use a generator header when the format supports comments.
  For other formats, record ownership in the generator manifest or project configuration. A directory name
  alone does not establish generated ownership.
- Generated output lives where the generator writes it and is declared as generated, so formatting,
  naming, and structure rules skip it and freshness, secrets, and size checks still run.
- A generated file equals a fresh run of its command. A difference is a defect in the change.
- Hand-written wrappers around generated types are small, named for the boundary that needs them,
  and owned by that boundary.
- Do not refactor generated output to satisfy a style rule. Fix the generator or declare the
  exception with a reason.
- Do not commit build output (`dist/`, `coverage/`, compiled assets) unless the deployment reads
  it from the repository, and then declare it.
