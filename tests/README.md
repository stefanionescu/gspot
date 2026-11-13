# Tests

With mise installed, run these commands from the repository root to install the pinned runtimes, the locked dependencies,
and the npm tools of the manifests:

```bash
mise install
mise run setup
```

When an npm pin of a manifest changes, the setup stops at `tests/setup/runner/test-tools.lock`, so update that lockfile:

```bash
bun install --cwd node_modules/.test-tools --linker isolated
cp node_modules/.test-tools/bun.lock tests/setup/runner/test-tools.lock
```

| Command                     | Coverage                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `mise run test unit`        | Source code in process, without network calls. Tests may use Git and tools in `node_modules/.test-tools/`.        |
| `mise run test integration` | Tool installation, registry access, and checks against installed tools.                                           |
| `mise run test e2e`         | Packed packages installed into fresh projects, including a Python and a Swift project through the installed hook. |

`mise run test` runs the unit suite. Each command builds the CLI and the ESLint plugin, and runs in a temporary test folder
that it removes at the end. Integration and end-to-end runs also pack the packages and need network access. Integration
runs install pinned tools, and end-to-end runs get their tools from `gspot install`.

To run one test file, or the tests whose name matches, put the files after the suite, then any `bun test` options:

```bash
mise run test unit tests/suites/unit/cli/main.test.ts
mise run test unit tests/suites/unit/cli/main.test.ts -t "version"
```

A direct `bun test` run needs `TEST_RUN_FOLDER`, a `--preload` file from `tests/setup/runner/`, and the `--timeout` of
its suite from `.mise/tasks/test`.

When you add a test, follow the suite boundaries and file placement rules in [repository rules](../AGENTS.md). Shared
setup, with the output schemas, lives in `tests/setup`.
