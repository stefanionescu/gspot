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

mise installs the native tool pins gspot writes to `.mise/conf.d/gspot-tools.toml`. Initialization proposes mise when it is available. An explicit runner choice takes precedence. The generated mise tool file requires mise 2026.8.8 or newer. It installs the CLI through the npm backend (`npm:@gspothq/cli`).

## Platform limits

SwiftFormat supports macOS and Linux. Xcode checks and XCTest coverage require macOS with Xcode selected by `xcode-select`. Container checks can require a running Docker daemon. Some scans and generators need network access. Each [check page](/reference/checks/) states its platforms and external requirements.

The Bash, zsh, and Bats scripts configuration uses Bash 4.4 or newer for its Bash checks. The Bash bundled with macOS is older. Install Bash 4.4 or newer. A check that cannot run reports the missing requirement instead of counting as passed.

If gspot reports that its runtime cannot resolve an existing filesystem path, use a path or runtime that supports that filename. This requirement applies to repository roots and source files.
