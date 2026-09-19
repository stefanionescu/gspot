---
title: "swift/trivial-function"
description: "Finds private functions of one or two statements that one place calls."
---

Finds private functions of one or two statements that one place calls.

## Why

A tiny function with one caller makes the reader jump to read two lines.

## What to do

Write the body at its caller, or allow the name under structure.swift.trivial_allowed with a reason.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore swift/trivial-function --paths <glob> --reason "<why>"`.
