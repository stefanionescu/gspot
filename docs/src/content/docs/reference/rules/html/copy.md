---
title: "html/copy"
description: "In the template files named by tools.html.template_files, checks that text a person reads is a placeholder and never a literal."
---

In the template files named by tools.html.template_files, checks that text a person reads is a placeholder and never a literal.

## Why

Copy written into a template is copy no translator and no content file ever sees.

## What to do

Replace the text with a placeholder and put the words in the content file. Exclude a path under tools.html.copy_excluded with a reason.

## Where it runs

- Preset: [the html preset](/reference/presets/html/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore html/copy --paths <glob> --reason "<why>"`.
