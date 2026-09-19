# `react-native`

Kind: framework. Requires: react. Recommends: typescript, vitest. Recommends: typescript, jest.

## Detects and claims

|        |                                                                             |
| ------ | --------------------------------------------------------------------------- |
| Detect | `react-native` or `expo` in dependencies                                    |
| Claims | `app.json`, `app.config.js`, `app.config.ts`, `metro.config.js`, `eas.json` |

## Tools

As libraries: @react-native/eslint-plugin 0.87.1, eslint-plugin-react-native 5.0.0, and
eslint-plugin-expo 1.1.0.

As a command: expo-doctor 1.20.4, where `expo` is a dependency.

eslint-plugin-react-native-a11y is left out: its range ends at ESLint 8 (D-142). eslint-config-expo
is left out, because it brings its own copies of the React and TypeScript rules, which the react
and typescript presets own.

## Generated configuration

Every shared rule of the javascript and typescript presets reads the files of this framework
too, with the same limits (D-137). A rule this preset turns off stands in its manifest with a
reason (D-138), and the page lists each one.

The ESLint config gains, over every code file:

- `@react-native/platform-colors` and `@react-native/no-deep-imports`;
- `react-native/no-unused-styles`, `react-native/no-raw-text`, `react-native/no-single-element-style-arrays`,
  and `react-native/split-platform-components`. At the `all` level: `react-native/no-inline-styles`
  and `react-native/no-color-literals`;
- the four rules of the Expo plugin: `expo/no-env-var-destructuring`, `expo/no-dynamic-env-var`,
  `expo/use-dom-exports`, and `expo/prefer-box-shadow`. The bundler replaces
  `process.env.EXPO_PUBLIC_NAME` where the text is written out in full.

The fragment exports four selectors, which the template joins into `no-restricted-syntax`
(D-139):

- an import of a `Touchable` component;
- a `FlatList` or a `SectionList` with no `keyExtractor`;
- a `map` call rendered inside a `ScrollView`;
- `AsyncStorage.setItem` with a key that names a secret.
  The
  fifth selector of the first form, an object inside a `style` prop, is the rule
  `react-native/no-inline-styles` now.

## Names

`[[naming.rules]]` of this preset: the file stem ends before a platform suffix (`.ios`,
`.android`, `.native`, `.web`), so `Button.ios.tsx` and `Button.android.tsx` are one name.

## Turned off

| Rule                  | Why                                                             |
| --------------------- | --------------------------------------------------------------- |
| every `jsx-a11y` rule | they read DOM elements, and a React Native view tree holds none |

## Checks

| Id                         | Stage | Command                                                         |
| -------------------------- | ----- | --------------------------------------------------------------- |
| `react-native/expo-doctor` | push  | `expo-doctor`, in a scope that depends on `expo`; needs network |

The ESLint rules run in `typescript/eslint` or `javascript/eslint`. `javascript/required-rules`
holds the two environment rules for `jsx` and `tsx` files.

## Settings

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <id>`.

## Rule files

`framework/react-native/REACT-NATIVE.md`.
