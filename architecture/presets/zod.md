# zod

Kind: library. Requires: typescript.

## Detects

`zod` in dependencies.

## Generated configuration

The ESLint config gains `eslint-plugin-zod` with the thirteen rules: `no-any-schema`,
`no-coerce-boolean`, `no-empty-custom-schema`, `no-native-enum`, `no-promise-schema`,
`no-throw-in-refine`, `no-number-schema-with-finite`, `prefer-top-level-string-formats`,
`prefer-strict-object`, `prefer-loose-object`, `prefer-meta`, `prefer-meta-last`,
`require-brand-type-parameter`.

## Checks

`typescript/eslint` with the rules above. No separate check.

## Settings

`tools.eslint.rules` for the `zod/*` family.

## Rule files

`library/zod/ZOD.md`.
