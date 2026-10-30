# Tests

The test suites cover source behavior, installed tools, and the packed CLI and ESLint plugin.

With mise installed, run these commands from the repository root to install the pinned runtimes, the locked dependencies, and the npm tools of the
manifests:

```bash
mise install
mise run setup
```

Choose a suite:

| Command                     | Coverage                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `mise run test unit`        | Source code in process, without network calls. Tests may use Git and tools in `node_modules/.test-tools/`. |
| `mise run test integration` | Tool installation, registry access, and checks against installed tools.                                    |
| `mise run test e2e`         | Packed packages installed into fresh projects, including the documented quickstarts.                       |

`mise run test` runs the unit suite. Each command builds the packages, creates a temporary test folder, and removes it
when the run ends. Integration and end-to-end runs also pack the packages and install pinned tools. These suites need
network access and take longer than the unit suite.

When adding a test, follow the suite boundaries and file placement rules in [repository rules](../AGENTS.md). Shared setup lives
in `tests/setup`; test values, types, and output schemas live in `tests/config`, `tests/types`, and `tests/schemas`.
