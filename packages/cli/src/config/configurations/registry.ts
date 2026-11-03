import type { LintRuleDocs } from '#cli/types/tools.ts';
import { UNUSED_ASSET_RULE } from '#cli/config/configurations/framework.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';

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
