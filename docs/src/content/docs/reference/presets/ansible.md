---
title: "Ansible"
description: "Ansible playbooks: ansible-lint in every folder that holds an ansible.cfg."
---

Ansible playbooks: ansible-lint in every folder that holds an ansible.cfg.

Kind: tool. Requires: `config-files`.

## Tools

- ansible-lint 26.8.0

## Checks

| Check                                            | Stage  | What it finds                                                |
| ------------------------------------------------ | ------ | ------------------------------------------------------------ |
| [`ansible/lint`](/reference/rules/ansible/lint/) | commit | Runs ansible-lint in every folder that holds an ansible.cfg. |
