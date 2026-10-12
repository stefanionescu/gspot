# React Native Configuration

`gspot init` detects `react-native` from React Native dependencies and `expo` from Expo
dependencies. The Expo configuration requires React Native and adds Expo rules and
`expo/doctor`. A bare React Native project does not require either Expo tool. React web
projects that depend on `react-dom` also select the React DOM configuration, which supplies
the DOM accessibility plugin. Native sources retain React's hooks and component rules.

## Custom native text components

If a component wraps React Native's `Text`, include its name in the rule's `skip` option:

```toml
[tools.eslint.rules]
"react-native/no-raw-text" = [{ skip = ["ThemedText"] }]
```

Option arrays omit the severity. The selected level decides which rules run, and options
apply only where that level enables the rule. This allows text inside `ThemedText`. The rule still reports bare text inside a `View`.
Set the option in the native project's scope when other projects use different components.
