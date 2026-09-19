---
title: "fastapi/no-blocking-io-in-async"
description: "Refuses time.sleep, the requests library, and a plain open inside an async function."
---

Refuses time.sleep, the requests library, and a plain open inside an async function.

## Why

A blocking call inside an async function stops the event loop, so every other request waits for it.

## What to do

Use asyncio.sleep, an async HTTP client, or run the call in a worker thread.

## Where it runs

- Preset: [the fastapi preset](/reference/presets/fastapi/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore fastapi/no-blocking-io-in-async --paths <glob> --reason "<why>"`.
