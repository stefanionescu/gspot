# `react`

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest.

## Detects

`react` in dependencies. A Vite app, a library of components, and a Next.js app all select it;
`nextjs` requires it, so the two share one copy of the React rules.

## Tools

As libraries, each with ESLint 9 in its range (D-142):

- eslint-plugin-react 7.37.5 and eslint-plugin-react-hooks 7.1.1;
- eslint-plugin-jsx-a11y 6.10.2 and eslint-plugin-react-refresh 0.5.7;
- eslint-plugin-testing-library 7.16.2.

## Generated configuration

Every shared rule of the javascript and typescript presets reads the files of this framework
too, with the same limits (D-137). A rule this preset turns off stands in its manifest with a
reason (D-138), and the page lists each one.

The ESLint config gains one block over `js`, `jsx`, `ts`, and `tsx` files:

- the `recommended` and `jsx-runtime` sets of the React plugin, with the React version set to
  `detect`;
- every rule of the `recommended-latest` set of the hooks plugin, as an error. The set holds the
  rules of hooks, `exhaustive-deps`, and the React Compiler rules. The plugin ships two of them
  as warnings, and the gate allows no warning;
- the `recommended` set of `jsx-a11y`, which is the enforcement of the accessibility guide;
- `react-refresh/only-export-components`, so a file of components keeps its state on a reload;
- `react/no-array-index-key`, `react/no-danger`, `react/no-unstable-nested-components`,
  `react/jsx-no-constructed-context-values`, and `react/no-object-type-as-default-prop`.

Over test files, the `react` set of the testing-library plugin. At the `all` level:
`react/self-closing-comp`.

## Names

`[[naming.rules]]` of this preset (D-112):

- a function that returns JSX is in PascalCase, and a hook starts with `use`;
- a callback may start with `handle`;
- a file that holds one component may carry its name.

## Turned off

Nothing.

## Checks

`typescript/eslint` or `javascript/eslint` with the rules above. No separate check.
`integrity/required-rules` holds `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`,
`react/jsx-key`, and `react/no-danger` for `jsx` and `tsx` files.

## Settings

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <id>`.

## Rule files

`framework/react/REACT.md`.
