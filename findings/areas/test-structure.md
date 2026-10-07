# Test Structure: Tiers, Harness, and Samples

Architecture material from the original audit follows. It is history, not the target. The decisions in [progress](../progress.json) and [the test layout review](../review/tests-layout.md) win where it differs.

`tests/config/` and `tests/types/` stay as mirrors, and a one-file mirror folder is flattened. Samples live in `tests/config/samples/`, the harness is flat, and Verdaccio and `scripts/registry/` are deleted. The small local npm registry moves to `tests/harness/registry.ts` with the Python index beside it, not into `npm.ts` or `uv.ts` (review/owner-decisions/005). Every suite has one per-test limit (review/carve-outs/001). `tests/tools/kits/` is `tests/tools/configurations/`.

Names follow [the glossary](../review/glossary.md), which wins over every name below. The harness is never a support folder, an engine input is a check input, and the registry is the local npm registry in `tests/harness/registry.ts`.

## Target layout

```text
Today
tests/
├── package.json          planted packages for sandboxes
├── bunfig.toml           preload runtime.ts; root = "."
├── tsconfig.json         extends ../tsconfig.json, nothing else
├── config/               cli.ts (QUIET_INIT, MINIMAL_POLICY), timeouts.ts (13 limits)
├── types/                cli.ts, package.ts, registry.ts, tools.ts
├── samples/              12 files of planted text
├── harness/              41 files: cli/ 17, planted/ 6, registry/ 6, tools/ 3, package/ 3, plugin/ 2, root 4
├── unit/                 cli/ 67, plugin/ 24
├── integration/          cli/ 187, package-runner.test.ts
├── tools/                cli/ 38
├── acceptance/           cli/ 11, kits/ 38
└── packages/             install/ 4, plugin.test.ts
scripts/
├── acceptance.ts         argument whitelist, then bun test ./acceptance under the plugin registry
├── package.ts            registry, publish, bun test ./packages
├── plugin.ts             gspot apply/install under the plugin registry
└── test-tools.ts         writes .mise/conf.d/test-tools.toml

After
tests/
├── package.json          planted packages (plus the test-only packages, if the owner agrees)
├── bunfig.toml           preload only
├── harness/              the one support folder, flat, about 25 files
│   ├── samples/          was tests/samples; duplicates and one-user samples removed; `script` moved here from planted/cases.ts
│   ├── timeouts.ts       was config/timeouts.ts; only limits with two or more users
│   ├── policy.ts         policyOf, policyProblems, initArgs, initOptions, QUIET_INIT (was cli/policy.ts + config/cli.ts + planted/init.ts)
│   ├── command.ts        runGspot, spawnGspot with stdin, gspot, root (the one root constant)
│   ├── sandbox.ts        installSandbox, install with a level, toolsPath, leaveOut, installPrivateTools, linkInstalledModules (was planted/sandbox.ts + tools/install.ts + cli/modules.ts)
│   ├── planted.ts        plantedCases, runPlanted, plant (was planted/cases.ts + planted/preservation.ts)
│   ├── generated.ts      emitted, generatedFile, generatedEslint; writeConfigs deleted
│   ├── input.ts          one engine-input builder (replaces checkInput, sessionInput, scopeInput, siteInput, swiftInput)
│   ├── package.ts        consumer and release reading (was package/consumer.ts + packages.ts + published.ts without publishRelease)
│   ├── npm.ts            was tools/npm.ts + registry/packages.ts
│   ├── uv.ts             was tools/python.ts + registry/python.ts (same two users)
│   ├── rule-tester.ts    was plugin/tester.ts
│   └── git.ts, process.ts, platforms.ts, expectations.ts, environment.ts, runtime.ts, spelling.ts,
│       correction.ts, migrations.ts, pins.ts, tracked.ts, python-modules.ts (was cli/python.ts)
├── cli/                  fast suite: unit/cli + integration/cli merged by source folder; the 3 same-name pairs become one file each
├── plugin/               fast suite: was unit/plugin
├── tools/                tool suite: was tools/cli/* (cli level dropped) + acceptance/*
│   ├── commands/         was acceptance/cli without the kit tests
│   ├── kits/             was acceptance/kits + acceptance/cli/{spelling,prose-ignore,commits}.test.ts
│   └── checks/ execution/ generation/ lifecycle/ packages/   was tools/cli/*
└── packages/             release suite: install/*.test.ts and plugin.test.ts in one flat folder
scripts/
├── registry/             was tests/harness/registry/{lifecycle.ts, server.ts, config.yaml}
├── plugin.ts             runs any command with the workspace plugin served (absorbs harness/registry/plugin.ts and scripts/acceptance.ts)
├── package.ts            absorbs publishRelease
└── test-tools.ts         unchanged

Deleted: tests/config/, tests/samples/ (moved into harness), tests/types/ (each type beside its user), tests/unit/, tests/integration/,
tests/acceptance/ (merged), tests/tsconfig.json (after one check), tests/integration/package-runner.test.ts,
scripts/acceptance.ts, harness/cli/{nextjs,tooling,site,swift}.ts and harness/planted/{push,secrets}.ts
(moved into their tests), harness/plugin/planted.ts (inlined).
Tasks: test = bun test ./cli ./plugin; test:tools = bun ../scripts/plugin.ts bun test ./tools;
test:acceptance deleted; test:package drops `depends = ["build:plugin"]`.
CI: the tools-and-acceptance job runs one sharded step instead of two.
Also update CONTRIBUTING.md:98-109 and the test paths in gspot.toml (lines 92, 264-279, 548-553, 567, 575, 652-658).
```
