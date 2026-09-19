---
title: "ansible/lint"
description: "Runs ansible-lint in every folder that holds an ansible.cfg."
---

Runs ansible-lint in every folder that holds an ansible.cfg.

## Why

A playbook runs as root on production hosts, and a task that is not idempotent changes them on every run.

## What to do

Change the task the way the rule says. Turn one rule off with gspot ignore ansible/lint --rule <id> --reason.

## Where it runs

- Preset: [the ansible preset](/reference/presets/ansible/)
- Stage: commit
- Tool: ansible-lint
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore ansible/lint --paths <glob> --reason "<why>"`.
