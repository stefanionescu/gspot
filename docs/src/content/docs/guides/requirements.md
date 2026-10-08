---
title: Requirements
description: Install Git and the runtimes needed by your applicable checks.
---

Every repository needs Git. gspot requires Node.js 24.2 or newer, or Bun 1.4.2 or newer, under every runner, including mise.

## Requirements depend on your files

`init --dry-run --yes` shows the applicable configurations and required tools. gspot installs tools only when applicable checks, fixers, or generators need them. Shared files also count: Markdown in a Python repository can require npm-based Markdown tools.

| Applicable tools                                                 | Requirement                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| npm tools, such as ESLint or markdownlint                        | Node.js and the declared npm, pnpm, Yarn, or Bun package manager. With no declaration, gspot uses npm. |
| Python tools, such as Ruff or yamllint                           | uv and the Python version required by those tools.                                                     |
| Native tools, such as ShellCheck, Gitleaks, or typos             | mise, or the exact pinned tools on `PATH`. `gspot doctor` lists missing tools with install commands.   |
| Project commands, such as Jest, Vitest, Next.js, or Swift builds | The project runtime, dependencies, and build tools. These remain your project's dependencies.          |

mise installs the native tool pins gspot writes to `.mise/conf.d/gspot-tools.toml`. Initialization proposes mise when it is available. An explicit runner choice takes precedence. The generated mise configuration requires mise 2026.8.8 or newer. It installs the CLI through the npm backend (`npm:@gspothq/cli`).

JavaScript and TypeScript checks use the project's TypeScript compiler when it is installed. If the project has none, gspot prefers its pinned compiler in the tool project over a global compiler. Run `gspot install` to install that compiler. An interrupted tool-project installation reports an error; it does not block an available project compiler.

TypeScript source files or an authored `tsconfig.json` select TypeScript checks. A TypeScript tool dependency or declaration files alone do not. When a scope has no authored configuration, gspot generates a standalone compiler project for its source files and declarations. The project excludes generated files, vendored files, and child scopes. An authored configuration keeps its project settings and receives the strict options required by the selected level.

JavaScript checks inherit an authored `jsconfig.json` first and `tsconfig.json` otherwise. The TypeScript fallback keeps compiler settings and declarations while selecting JavaScript sources for this check. An authored JSX setting remains in force; otherwise the generated project uses `jsx: "preserve"`. Scopes without either project file use Bundler resolution when an extensionless import style matches a JavaScript source file. Ambient types come from the source project, including authored custom roots.

## Platform limits

SwiftFormat supports macOS and Linux. Xcode checks and XCTest coverage require macOS with Xcode selected by `xcode-select`. Container checks can require a running Docker daemon. Some scans and generators need network access. Each [check page](/reference/checks/) states its platforms and external requirements.

The Bash, zsh, and Bats scripts configuration uses Bash 4.4 or newer for its Bash checks. macOS's bundled Bash is older; install the required Bash separately. A check that cannot run reports the missing requirement instead of counting as passed.

If gspot reports that its runtime cannot resolve an existing filesystem path, use a path or runtime that supports that filename. This requirement applies to repository roots and source files.
