# TypeScript Configuration

JavaScript and TypeScript checks use the project's TypeScript compiler when available. If the project has none, gspot prefers its pinned compiler in the tool project over a global compiler. Run `gspot install` to install that compiler. An interrupted tool-project installation reports an error; it does not block an available project compiler.

TypeScript source files or your own `tsconfig.json` select TypeScript checks. A TypeScript tool dependency or declaration files alone do not. When a scope has no configuration of your own, gspot generates a standalone compiler project for its source files and declarations. The project excludes generated files, vendored files, and child scopes. Your own configuration keeps its project settings and receives the strict options required by the selected level.

See [JavaScript details](/reference/configurations/javascript/#details) for settings translated into ESLint plugin options.
