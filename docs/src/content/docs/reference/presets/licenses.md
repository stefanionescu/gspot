---
title: "Licenses"
description: "Every installed dependency reports a license from the allowed list, or carries an exception that names the license it reports."
---

Every installed dependency reports a license from the allowed list, or carries an exception that names the license it reports.

Kind: concern.

## Tools

- license-checker-rseidelsohn 5.0.1

## Checks

| Check                                            | Stage | What it finds                                                                                      |
| ------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------- |
| [`licenses/npm`](/reference/rules/licenses/npm/) | push  | Compares the license every installed npm package reports with the allowed list and the exceptions. |

## Settings

- `tools.licenses.allow`: The SPDX license ids a dependency may report.
- `tools.licenses.exceptions`: Packages accepted under a license outside the list: name@version, the license it reports, and the reason.
