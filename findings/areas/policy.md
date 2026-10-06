# Policy, Kits, Rules, Config, and Types

Architecture material from the original audit follows. Current repository decisions are recorded in [progress](../progress.json).

## Target layout

```text
Today
packages/cli/src/
├── config/                 68 .ts + eslint-levels.json; one constants file per source folder
│   ├── policy/{policy,profiles,toml}.ts
│   ├── kits.ts  rules.ts  output.ts
│   └── checks/** commands/** execution/** generation/** lifecycle/** parsers/** platform/** repository/** tools/**
├── types/                  56 .ts; one types file per source folder
│   ├── policy/{policy,profiles,toml}.ts
│   ├── kits.ts  rules.ts  output.ts
│   └── checks/** commands/** execution/** generation/** lifecycle/** parsers/** platform/** repository/** tools/**
├── policy/                 23 files
│   ├── audit.ts  check-state.ts  fields.ts  json-schema.ts  loosening.ts  merge.ts  messages.ts
│   ├── mutations.ts  normalize.ts  problems.ts  read.ts  schema.ts  setting-surface.ts  settings.ts
│   ├── tools.ts  validate.ts  written-keys.ts
│   ├── profiles/{export,parse,schema}.ts
│   └── toml/{nodes,tables,width}.ts
├── kits/                   13 files
│   ├── command.ts  detect.ts  listing.ts  manifests.ts  messages.ts  output.ts  owners.ts
│   └── problems.ts  schema.ts  select.ts  takeover.ts  targets.ts  tools.ts
└── rules/                  3 files
    └── assemble.ts  instructions.ts  sections.ts

After
packages/cli/src/
├── (config/ deleted)       each constant moves, unexported, into the one module that reads it.
│                           Real shared tables go to their owner: config/platform/locations.ts -> platform/locations.ts;
│                           EXTENSION_TAGS, FILENAME_TAGS, SHEBANG_TAGS -> repository/tags.ts; the five lockfile tables
│                           -> one repository/lockfiles.ts; eslint-levels.json -> generation/eslint/ ("all" rules only).
├── (types/ deleted)        each type moves beside its producer; zod-backed types become z.infer / z.output
│                           in the schema file.
├── policy/                 14 files in 3 folders (was 23 + 3 config + 3 types)
│   ├── read.ts             read.ts; strict reader absorbs assertPolicyComplete; one throw helper
│   ├── normalize.ts        normalize.ts + the Policy types + repositoryCheckSpec (from check-state.ts);
│   │                       keeps the TOML key names
│   ├── edit.ts             was mutations.ts; plain functions, no closure factories; + Mutation, Proposal, TomlTable
│   ├── toml-layout.ts      toml/nodes.ts + toml/tables.ts + toml/width.ts + types/policy/toml.ts + config/policy/toml.ts
│   ├── profiles.ts         profiles/export.ts + parse.ts + schema.ts + config/policy/profiles.ts
│   │                       + types/policy/profiles.ts; one path walker
│   ├── schema/
│   │   ├── policy.ts       was schema.ts (rulesSchema moves to rules/assemble.ts)
│   │   ├── tools.ts        was policy/tools.ts (the [tools.*] tables)
│   │   └── fields.ts       was fields.ts (kept: it breaks the policy.ts <-> tools.ts import cycle)
│   ├── problems/
│   │   ├── reasons.ts      loosening.ts + the reason checks of problems.ts + the reason messages
│   │   ├── keys.ts         audit.ts + written-keys.ts: unknown and loosened keys; one unknown-key message
│   │   │                   shared with commands/set.ts
│   │   └── selection.ts    validate.ts + the scope-folder checks of problems.ts
│   └── settings/
│       ├── known.ts        was setting-surface.ts (exposedSettings -> knownSettings) + TOOL_DEADLINE
│       ├── values.ts       was settings.ts
│       └── view.ts         was merge.ts (mergeForScope -> scopeView, MergedView -> ScopeView)
│   deleted: check-state.ts -> execution/planning/skips.ts + normalize.ts; messages.ts -> its callers;
│            json-schema.ts -> the docs package, its only caller; shippedPolicy -> kits/naming-terms.ts
├── kits/                   9 files (was 13 + config/kits.ts + types/kits.ts)
│   ├── schema.ts           schema.ts + output.ts + manifest types (Manifest, CheckSpec, SettingSpec, Level, NamingRule)
│   ├── tool-schema.ts      tools.ts + command.ts; ToolPin derived from zod; INSTALLER_KEYS, TOOL_PLATFORMS
│   ├── manifests.ts        manifests.ts + listing.ts + targets.ts (kitName -> configName);
│   │                       gitignoreBlock moves to generation
│   ├── problems.ts         + the three checks now inline in parseManifest
│   ├── select.ts           + unknownKit, circularRequires (kits/messages.ts deleted)
│   ├── detect.ts  owners.ts  takeover.ts
│   └── naming-terms.ts     shippedPolicy from policy/audit.ts, renamed namingTerms()
└── rules/                  2 files (was 3 + config/rules.ts + types/rules.ts)
    ├── assemble.ts         assemble.ts + sections.ts + its constants and types + rulesSchema
    │                       (RuleSettings = z.output)
    └── instructions.ts     + AREA_BY_LAYER and all managed-block text inline
```

No folder in "After" holds a single file, so the lone-files check stays satisfied.
