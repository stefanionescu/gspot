---
title: The policy file
description: Choose configurations and a level, change settings, and record exceptions in gspot.toml.
---

`gspot.toml` holds every choice gspot follows: the configurations, the level, the settings, and the
exceptions. The commands on this page edit it for you and apply the change.

## See the current choices

```bash
gspot list
gspot list settings
```

`gspot list` shows the configurations and one row per check with its state in each scope that selects its configuration.
`gspot list settings` shows root values and the settings each scope changes, with their sources.
Long values are shortened. Add `--json` to read complete values and inherited settings.
The [settings reference](/reference/settings/)
lists every setting with its accepted values and defaults.

## Configurations and the level

A policy starts with the configurations it selects:

```toml
configurations = ["bash"]
level = "recommended"
require_reasons = true
```

A configuration groups checks, tool configuration, and agent rules for a language, framework,
or concern. General checks are selected automatically, including with a manually authored
configuration list. To override a language or framework, run `gspot add <configuration>` or
`gspot remove <configuration>`. Change general check coverage with the level or a reasoned ignore.

`apply` updates automatically detected language and framework selections when repository files or
dependencies change. It keeps manual language and framework additions and removals at the root
and in scopes, including choices from `init --configurations`, `--scope-configurations`, and
edits to authored configuration lists. A manual removal stays removed when its detection
source disappears and returns. These overrides select project configurations; `recommended`
and `all` control check coverage.

Initialization detects `react-native` from React Native dependencies and `expo` from Expo
dependencies. The Expo configuration requires React Native and adds Expo lint rules and
`expo/doctor`. A bare React Native project does not require either Expo tool. React web
projects that depend on `react-dom` also select the React DOM configuration, which supplies
the DOM accessibility plugin. Native sources retain React's hooks and component rules.

The [levels table](/guides/overview/#levels) defines `recommended` and `all`. Neither enables experimental or preview rules. To change the level:

```shell
gspot set level all
```

The level controls every applicable check. Security checks are selected automatically for supported source files. Duplication checks run at `all`. License checks are selected when a dependency manifest exists and wait for the project's allowed license list.

Next.js builds run at `all` when the selected scope contains an `app/`, `src/app/`,
`pages/`, or `src/pages/` tree. The project must provide a supported Next.js executable
and the dependencies its build needs. `recommended` retains the Next.js type check.

Framework syntax follows declared project dependencies. A NestJS project that declares
`@nestjs/swagger` receives Swagger lint contracts. CSS accepts Tailwind at-rules when the
nearest containing npm project declares `tailwindcss`. A dependency in a child or sibling
project does not change its parent's rules.

## Record one exception

This example lets scripts print to the terminal:

```bash
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

The ignore turns off the lint rule `no-console` for the paths under `scripts/`. Leave out
`--rule` to turn off the whole check. With `require_reasons = true`, gspot refuses an ignore
without a reason. Add `--until YYYY-MM-DD` for a temporary acceptance. It stops applying at 00:00 UTC on that date; the saved entry remains for review. Dependency advisory exceptions use the same `[[ignore]]` table with `check = "dependencies/osv"` and the advisory ID in `rule`.

When the cause is gone, remove the ignore and run the check again:

```bash
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --remove
```

A report prints how many ignores applied. `--verbose` prints each ignore with its reason and the number of findings it matched.

## Change a limit

```bash
gspot set limits.function_lines 80 --reason "The parser is one state machine."
```

With `require_reasons = true`, loosening a limit needs a reason. Tightening one does not. The
JavaScript and TypeScript size limits apply to test files and test functions too.

At level `all`, gspot reports functions with 2 statements or fewer, in every language it
checks. To change the number for every language, or for one language:

```bash
gspot set limits.min_function_statements 1
gspot set limits.python.min_function_statements 4
```

Any whole number of 1 or more works. A higher number reports more functions.

More ways to write a setting:

- `--scope api` writes the setting in the scope `api`.
- `--default` removes your value, so the inherited or default value applies.
- For a list, `--replace` replaces the whole list, and `--remove` removes items from it.

## Edit the file by hand

You can edit `gspot.toml` directly. Afterwards, apply the change and install any new tools:

```bash
gspot apply
gspot install
```

`gspot apply --dry-run` shows the change first, including every rule that turns on or off.
Rule differences compare the proposed rules with the last successful apply. Edited generated
files also show a file diff, so you can see the authored change alongside the proposed output.

## Reconcile project changes

After adding or removing a stack, run `gspot apply --dry-run`, then `gspot apply` and `gspot install`. `apply` adds applicable configurations and deactivates language and framework configurations whose evidence disappeared, while retaining manual language and framework overrides. It preserves settings, custom checks, ignores, reasons, and authored scope policy for returning projects.

Shared-file configurations stay applicable while their inputs exist. An edited managed output is reported instead of overwritten. `check` and `doctor` report stale setup and do not reconcile it.

See [Upgrade gspot](/guides/upgrade/) to install a new version and update the repository pin.

## JavaScript runtimes

ESLint gives each file one runtime. Ordinary modules use Node.js built-ins; `.cjs` and `.cts`
files also receive CommonJS globals. React, Vue, Svelte, and Vite application sources use
browser globals. React Native sources use native globals. Build scripts retain Node.js.
Next.js sources retain Node.js by default because server components can use its APIs.

Use `tools.eslint.runtimes` to declare another runtime for a file selector:

```toml
[tools.eslint.runtimes]
"src/client/**" = "browser"
"src/workers/**" = "worker"
"src/service-worker.js" = "service-worker"
```

Selectors are relative to the scope that reads the setting. Root settings are inherited, and
a scope can replace the runtime table. Later selectors take precedence when they overlap.
A child scope reads its own settings and framework defaults. Use an explicit `node` selector
for server code inside a browser or native project.

Runtime names follow the pinned [globals package](https://github.com/sindresorhus/globals);
`service-worker` names its service-worker
set. Web Workers and service workers have different APIs. Browser and native files do not
receive Node.js lint rules. React Native retains the `process` and `require` globals its
runtime supports, and does not receive Node.js globals such as `Buffer` and `__dirname`.
Unknown runtime names fail policy validation before configuration is generated.

## Custom native text components

If a component wraps React Native's `Text`, include its name in the lint rule's `skip` option:

```toml
[tools.eslint.rules]
"react-native/no-raw-text" = [{ skip = ["ThemedText"] }]
```

Option arrays omit the native severity. The selected level decides which rules run, and options
apply only where that level enables the rule. This allows text inside `ThemedText`. The rule still reports bare text inside a `View`.
Set the option in the native project's scope when other projects use different components.

## Markdown rule options

Markdown rule settings hold native option tables, without an enable/disable value or a `default` key:

```toml
[tools.markdownlint.rules]
MD024 = { siblings_only = false }
```

This reports repeated headings throughout a document, rather than only under the same parent heading.
The selected level decides which rules run. Options cannot enable a rule outside that level.
Both levels check image alt text. Accept a specific finding with `gspot ignore markdown/markdownlint --rule <rule> --reason "<why>"`.

## Stylesheet rule options

Stylelint options apply only to rules active at the selected level:

```toml
[tools.stylelint.rules]
color-hex-length = "long"
number-max-precision = 0
```

This requires long hexadecimal colors at both levels. The precision option applies at `all`, where the rule runs.
Severity stays `error`. Accept a finding with `gspot ignore css/stylelint --rule <rule> --reason "<why>"`.
Project-specific WebKit properties can use the native `ignoreProperties` option of `property-no-vendor-prefix`.
At-rule exceptions use the native options of `at-rule-no-unknown`:

```toml
[tools.stylelint.rules]
at-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]
```

Vue and Svelte own their component style parsers and syntax exemptions. Plain CSS receives
neither framework's exemptions. Tailwind directives and `theme()` require a declared
`tailwindcss` dependency in the nearest containing npm project. The HTML parser package is
installed only when Stylelint consumes a selected framework's component styles.

Native value validation exempts declarations containing `theme()` or Vue's `v-bind()`. Other
declarations still receive value checks.
Vue variables inside `v-bind()` retain their case. CSS keywords still require lowercase.

## Settings for one integration

- [Tests and coverage](/guides/testing/): Jest, Vitest, pytest, and Swift tests.
- [Dependency licenses](/guides/dependency-licenses/): allowed licenses and exceptions.
- [Security](/guides/security/): Semgrep, Swift security rules, and CodeQL.
- [Monorepos](/guides/monorepos/): settings for one project in the repository.
