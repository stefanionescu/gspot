---
title: "html/scripts"
description: "Refuses executable inline script, event handler attributes, javascript: links, and document.write in HTML files."
---

Refuses executable inline script, event handler attributes, javascript: links, and document.write in HTML files.

## Why

A content security policy that allows inline script allows an injected one too, so the policy only holds when the pages hold none.

## What to do

Move the script into a file, and attach the handler from that file. Structured data of type application/ld+json stays inline.

## Where it runs

- Preset: [the html preset](/reference/presets/html/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore html/scripts --paths <glob> --reason "<why>"`.
