# JavaScript Configuration

gspot translates settings into plugin rule options:

| Setting                                  | Plugin rule                                                            | Rule option                                 |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| `architecture.roles.environment_readers` | `n/no-process-env`, `no-restricted-properties`, `no-restricted-syntax` | paths allowed to read environment variables |
| `tools.eslint.import_extension`          | `n/file-extension-in-import`                                           | import extension                            |
| `limits.index_exports`                   | `barrel-files/avoid-barrel-files`                                      | `amountOfExportsToConsiderModuleAsBarrel`   |
| `structure.reexports = "index-only"`     | ESLint re-export rules and `no-trivial-files`                          | index exemptions                            |

Environment-reader checks and limits on index files that re-export other files apply at level `all`. The index limits apply when you allow re-exports. See the [ESLint plugin reference](/reference/eslint-plugin/) for the rule options.

## JavaScript runtimes

ESLint gives each file one runtime. Ordinary modules use Node.js built-ins; `.cjs` and `.cts`
files also receive CommonJS globals. React, Vue, and Svelte application sources use
browser globals. React Native sources use native globals. Build scripts retain Node.js.
Next.js sources retain Node.js by default because server components can use its APIs.

Use `[[tools.eslint.override]]` to declare another runtime for a file selector:

```toml title="Runtime choices in gspot.toml"
[[tools.eslint.override]]
paths = ["src/client/**"]
runtime = "browser"

[[tools.eslint.override]]
paths = ["src/workers/**"]
runtime = "worker"

[[tools.eslint.override]]
paths = ["src/serviceworker.js"]
runtime = "serviceworker"
```

Write paths relative to the repository root. Later records win when they overlap.
Use an explicit `node` runtime for server code inside a browser or React Native project.

Runtime names follow the pinned [globals package](https://github.com/sindresorhus/globals);
`serviceworker` names its serviceworker
set. Web Workers and service workers have different APIs. Browser and native files do not
receive Node.js rules. React Native retains the `process` and `require` globals its
runtime supports, and does not receive Node.js globals such as `Buffer` and `__dirname`.
gspot rejects unknown runtime names before writing tool files.

JavaScript checks inherit your own `jsconfig.json` first and `tsconfig.json` otherwise. The TypeScript fallback keeps compiler settings and declarations while selecting JavaScript sources for this check. Your own JSX setting remains in force; otherwise the generated project uses `jsx: "preserve"`. Scopes without either project file use Bundler resolution when an extensionless import style matches a JavaScript source file. Ambient types come from the source project, including your own custom roots.

For compiler selection, see [TypeScript details](/reference/configurations/typescript/#details).
