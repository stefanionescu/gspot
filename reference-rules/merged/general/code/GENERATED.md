---
layer: code
preset: rules
title: Generated Code
---

# Generated Code

- A generated file is never edited by hand. Change the source or the generator and regenerate
  through the owning command. `enforced-by: integrity/generated-fresh`
- Every generated file opens with a header that names the generator and the command that produced
  it. A generated file without a header is a hand-written file and is held to every rule. `enforced-by: integrity/generated-fresh`
- Generated output lives where the generator writes it and is declared as generated, so formatting,
  naming, and structure rules skip it and freshness, secrets, and size checks still run. `enforced-by: integrity/generated-fresh`
- The gate regenerates and diffs: a generated file that differs from a fresh run is a finding. `enforced-by: integrity/generated-fresh`
- Hand-written wrappers around generated types are small, named for the boundary that needs them,
  and owned by that boundary. `unenforced`
- Do not refactor generated output to satisfy a style rule. Fix the generator or declare the
  exception with a reason. `unenforced`
- Do not commit build output (`dist/`, `coverage/`, compiled assets) unless the deployment reads
  it from the repository, and then declare it. `unenforced`
