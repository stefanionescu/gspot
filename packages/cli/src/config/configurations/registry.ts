import type { LintRuleDocs } from '#cli/types/tools.ts';
import { WEAKENING_RULES } from '#cli/config/configurations/structure.ts';
import { UNUSED_ASSET_RULE } from '#cli/config/configurations/framework.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { YAML_RULES, YAML_MESSAGES } from '#cli/config/configurations/general.ts';

export const GENERATOR_IGNORED_FOLDERS = [NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER] as const;

export const RULES = { stale: 'stale', missing: 'missing', untracked: 'untracked' } as const;

export const TSC_REFERENCE_OUTPUT_FOLDER = 'typescript';

export const TSC_CONFIG_INPUT_PATHS = ['extends', 'files', 'include', 'exclude'] as const;

export const TSC_COMPILER_INPUT_PATHS = ['baseUrl', 'rootDir', 'rootDirs', 'typeRoots'] as const;

export const TSC_REFERENCE_BUNDLE = 'output.js';

export const TSCONFIG_TSBUILDINFO = 'tsconfig.tsbuildinfo';

export const TSBUILDINFO_FLAG = '--tsBuildInfoFile';

export const TSC_BUILD_COMMAND = ['tsc', '-b'] as const;

export const TSC_PROJECT_COMMAND = ['tsc', '--noEmit', '-p'] as const;

export const TYPESCRIPT_DEFAULTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
} as const;

export const DEFAULT_LEVEL_OPTIONS = { strict: true } as const;

export const COMPILER_OPTIONS = {
    ...DEFAULT_LEVEL_OPTIONS,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

export const NESTJS_COMPILER_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true } as const;

export const TYPESCRIPT_TSCONFIG_CHECK = 'typescript/tsconfig';

export const WEAKENING_RULE_DOCS = {
    [WEAKENING_RULES.baseline]: {
        description: '`gspot.baseline.json` counts more findings than at the base revision.',
        why: 'A count that grows accepts new findings as old ones.',
        fix: 'Fix the new findings, and run `gspot baseline --prune`.',
        example: 'A count that rises from one to two in `src/app.ts` reports `baseline`.',
    },
    [WEAKENING_RULES.hooks]: {
        description: '`hooks.enabled` turns off against the base revision.',
        why: 'Without the hooks, the checks run only when someone asks for them.',
        fix: 'Set `hooks.enabled` back to true.',
        example: '`enabled = false` under `[hooks]` reports `hooks`.',
    },
    [WEAKENING_RULES.level]: {
        description: '`level` drops against the base revision.',
        why: 'A lower level turns off every check that runs only at the higher one.',
        fix: 'Set `level` back.',
        example: '`level = "basic"` where the base has `level = "all"` reports `level`.',
    },
    [WEAKENING_RULES.ruleFiles]: {
        description: '`rule_files` turns off the rule files, or leaves more of them out, against the base revision.',
        why: 'An agent follows only the rules it can read.',
        fix: 'Set `rule_files.enabled` back to true, or remove the entry from `rule_files.exclude`.',
        example: '`enabled = false` under `[rule_files]` reports `rule-files`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const YAML_RULE_DOCS = {
    [YAML_RULES.syntax]: {
        description: 'YAML must parse without syntax errors.',
        why: 'A consumer cannot read malformed YAML.',
        fix: 'Fix the syntax at the reported line, then check the file again.',
        example: '`items: [` needs a closing bracket, such as `items: []`.',
    },
    [YAML_RULES.duplicate]: {
        description: 'Each mapping key appears once.',
        why: 'Consumers can reject duplicate keys or silently discard one value.',
        fix: 'Keep one definition of the key and remove the other.',
        example: 'Replace two `enabled:` entries in the same mapping with one.',
    },
    [YAML_RULES.anchors]: {
        description: 'Aliases name preceding anchors in the same document, and every anchor has a use.',
        why: 'An undefined alias has no value, and an unused anchor adds misleading structure.',
        fix: 'Declare the anchor before its alias, or remove the unused anchor.',
        example: '`timeout: &request-timeout 30` followed by `retry_timeout: *request-timeout` shares one value.',
    },
    [YAML_RULES.truthy]: {
        description: 'Boolean-looking strings are quoted, and booleans use lowercase true or false.',
        why: 'YAML versions disagree about whether yes, no, on, and off are strings or booleans.',
        fix: YAML_MESSAGES.truthy,
        example: 'Write `answer: "yes"` for a string or `enabled: true` for a boolean.',
    },
    [YAML_RULES.octal]: {
        description: 'Plain numbers have no leading zero or octal prefix.',
        why: 'YAML versions can read the same leading-zero value as different numbers.',
        fix: YAML_MESSAGES.octal,
        example: 'Write `mode: "0755"` when the exact digits matter.',
    },
    [YAML_RULES.documents]: {
        description: 'A file contains one YAML document.',
        why: 'A consumer that reads one document can miss the rest of a stream.',
        fix: YAML_MESSAGES.documents,
        example: 'Split documents separated by `---` into separate files unless the consumer requires a stream.',
    },
    [YAML_RULES.merge]: {
        description: 'Mappings have explicit keys instead of the << merge key.',
        why: 'YAML 1.2 does not define merge keys, and consumers can ignore them.',
        fix: YAML_MESSAGES.merge,
        example: 'Replace `<<: *defaults` with the mapping keys the consumer needs.',
    },
    [YAML_RULES.anchorNames]: {
        description: 'An anchor name describes the value it holds.',
        why: 'Generated names hide the relationship between the anchor and its aliases.',
        fix: 'Rename the anchor and its aliases for their shared value.',
        example: 'Replace `&a1` and `*a1` with `&request-timeout` and `*request-timeout`.',
    },
    [YAML_RULES.version]: {
        description: 'A decimal-looking string with a trailing zero is quoted.',
        why: 'A numeric parser discards the trailing zero of a value such as 1.10.',
        fix: YAML_MESSAGES.version,
        example: 'Write `version: "1.10"` to keep the complete version string.',
    },
    [YAML_RULES.comments]: {
        description: 'Comments sit above the key, except version comments after pinned actions.',
        why: 'A comment above a key stays separate from its value.',
        fix: YAML_MESSAGES.comments,
        example: 'Move `enabled: true # required` to a comment line above `enabled: true`.',
    },
    [YAML_RULES.extension]: {
        description: 'YAML files use .yml unless a consumer names the .yaml file.',
        why: 'One extension keeps file discovery predictable while preserving required tool names.',
        fix: YAML_MESSAGES.extension,
        example: 'Rename `settings.yaml` to `settings.yml`; keep `pnpm-workspace.yaml`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const UNUSED_ASSET_RULE_DOCS = {
    [UNUSED_ASSET_RULE]: {
        description: 'No page, stylesheet, or script names a file under an assets folder.',
        why: 'The file ships with every deploy, and nobody can tell whether a page still needs it.',
        fix: 'Delete the file, or name it in the page, stylesheet, or script that loads it.',
        example: '`src/assets/old-logo.png`, which no page or stylesheet names, reports `unused-asset`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const DOCSTRING_STYLES = ['google', 'numpy', 'sphinx'] as const;

export const IGNORE_SECTION_TITLES = {
    build: 'Build output',
    gspot: 'Files that gspot generates',
    generators: 'Generator outputs',
    configurations: 'Paths that configurations leave out',
    lockfiles: 'Lockfiles',
    submodules: 'Git submodules',
} as const;

export const NESTJS_CONFIGURATION = 'nestjs';
