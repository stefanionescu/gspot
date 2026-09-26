---
layer: template
configuration: none
title: Reference Template
---

# Reference Template

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Template. Remove sections that do not apply. Do not publish empty headings or placeholder
prose.

````markdown
# SURFACE_NAME Reference

State the reference scope.

## Syntax

```LANGUAGE
SYNTAX
```

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `NAME` | `TYPE` | Yes | None | DESCRIPTION |

## Output

Define the result and side effects.

## Errors

| Error | Condition | Resolution |
|-------|-----------|------------|
| `ERROR_CODE` | CONDITION | RESOLUTION |

## Examples

Explain the example.

```LANGUAGE
EXAMPLE
```
````
