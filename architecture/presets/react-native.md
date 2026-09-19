# `react-native`

Kind: framework. Requires: react. Recommends: typescript, vitest.

## Detects and claims

|        |                                                                             |
| ------ | --------------------------------------------------------------------------- |
| Detect | `react-native` or `expo` in dependencies                                    |
| Claims | `app.json`, `app.config.js`, `app.config.ts`, `metro.config.js`, `eas.json` |

## Tools

eslint-plugin-expo 1.1.0, as a library.

eslint-plugin-react-native and eslint-config-expo are left out. The first names no ESLint past 9
in its peer range. The second brings its own copies of the React and TypeScript rules, which the
react and typescript presets already own.

## Generated configuration

The ESLint config gains the four rules of the Expo plugin over every code file:
`expo/no-env-var-destructuring`, `expo/no-dynamic-env-var`, `expo/use-dom-exports`, and
`expo/prefer-box-shadow`. The bundler replaces `process.env.EXPO_PUBLIC_NAME` where the text is
written out in full, so a destructured or computed read finds nothing at run time.

`no-restricted-syntax` gains five selectors:

- an object written inside a `style` or `contentContainerStyle` prop;
- an import of a `Touchable` component from `react-native`;
- a `FlatList` or a `SectionList` with no `keyExtractor`;
- a `map` call rendered inside a `ScrollView`;
- `AsyncStorage.setItem` with a key that names a token, a secret, a password, or a credential.

## Checks

`typescript/eslint` or `javascript/eslint` with the rules above. No separate check.
`integrity/required-rules` holds the two environment rules for `jsx` and `tsx` files.

## Settings

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <id>`.

## Rule files

`framework/react-native/REACT-NATIVE.md`.
