# `react-hook-form`

Kind: library. Requires: javascript.

## Detects

`react-hook-form` in dependencies.

## Generated configuration

The ESLint config gains `no-restricted-syntax` selectors: `useForm` carries a `resolver`, and
`handleSubmit` wraps every submit handler. A selector cannot see that one element holds both a
`register` spread and a `value`, so that rule lives in the rule file only.

## Checks

`typescript/eslint` with the selectors.

## Settings

None.

## Rule files

`library/react-hook-form/REACTHOOKFORM.md`.
