---
title: Generated Code
---

# Generated Code

- A generated file is never edited by hand. Change the source or the generator and regenerate
  through the owning command.
- Mark a generated file with a header that names its command. If the format has no comments, list
  the file in a `[[generated]]` table of `gspot.toml`. A directory name alone proves no ownership.
- A generated file equals a fresh run of its command. A difference is a defect in the change.
- Do not commit build output (`dist/`, `coverage/`, compiled assets) unless the deployment reads
  it from the repository, and then declare it.
