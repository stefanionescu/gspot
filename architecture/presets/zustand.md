# `zustand`

Kind: library. Requires: javascript.

## Detects

`zustand` in dependencies.

## Generated configuration

The ESLint config gains `no-restricted-syntax` selectors: a store is created once per module and
exported as a hook; no store creation inside a component; selectors passed to the hook.

## Checks

`typescript/eslint` with the selectors; `gspot/registry-instance-only` treats store files as
registries when `[tools.zustand] store_files` names them.

## Settings

`tools.zustand.store_files` (default `**/store.ts`, `**/stores/*.ts`).

## Rule files

`library/zustand/ZUSTAND.md`.
