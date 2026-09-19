# `react`

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest.

## Detects

`react` in dependencies. A Vite app, a library of components, and a Next.js app all select it;
`nextjs` requires it, so the two share one copy of the React rules.

## Tools

eslint-plugin-react-hooks 6.1.1 and eslint-plugin-react 7.37.5, as libraries.

eslint-plugin-jsx-a11y is left out until a release names ESLint 10 in its peer range.

## Generated configuration

The ESLint config gains one block over `js`, `jsx`, `ts`, and `tsx` files:

- every rule of the `recommended-latest` set of the hooks plugin, as an error. The set holds the
  rules of hooks, `exhaustive-deps`, and the React Compiler rules. The plugin ships two of them as
  warnings, and the gate allows no warning.
- `react/jsx-key`, `react/jsx-no-target-blank`, `react/no-array-index-key`, `react/no-danger`,
  `react/no-unstable-nested-components`, `react/jsx-no-constructed-context-values`,
  `react/no-object-type-as-default-prop`, and `react/self-closing-comp`.

The React plugin finds the installed React through an ESLint function that ESLint 10 took out, and
every rule that asks for the version fails to load. The generated config reads the version from
`node_modules/react/package.json`, in the root and then in each scope, and hands it to the plugin.

## Checks

`typescript/eslint` or `javascript/eslint` with the rules above. No separate check.
`integrity/required-rules` holds `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`,
`react/jsx-key`, and `react/no-danger` for `jsx` and `tsx` files.

## Settings

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <id>`.

## Rule files

`framework/react/REACT.md`.
