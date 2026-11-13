import { GSPOT_PATHS, SHEBANG_TAG } from '#cli/config/manifests.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import type { GrammarName } from '#cli/types/parsers.ts';

// bash scripts
export const BASH_SOURCE_COMMANDS = new Set(['source', '.']);

// deno
export const DENO_CONFIG_FILES = ['deno.json', 'deno.jsonc'] as const;

// format defaults
export const DEFAULT_QUOTES = { prettier: 'single', ruff: 'double' } as const;

// framework files
export const ASTRO_FILES = ['**/*.astro'] as const;
export const ASTRO_SCRIPT_FILES = ['**/*.astro/*.ts', '**/*.astro/*.js'] as const;
export const EXCLUDE_FLAG = '--exclude';
export const REACT_FILES = ['**/*.{js,jsx,ts,tsx}'] as const;

// generator outputs
export const GENERATOR_IGNORED_FOLDERS = [NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER] as const;
export const GENERATOR_OUTPUT_RULES = { stale: 'stale', missing: 'missing', untracked: 'untracked' } as const;

// grammar selection
export const GRAMMAR_CONFIGURATIONS: ReadonlySet<string> = new Set([
    'bash',
    'swift',
    'python',
    'javascript',
    'typescript',
] satisfies readonly GrammarName[]);

// ignore sections
export const IGNORE_SECTION_TITLES = {
    build: 'Build output',
    gspot: 'Files that gspot generates',
    generators: 'Generator outputs',
    configurations: 'Paths that configurations leave out',
    lockfiles: 'Lockfiles',
    submodules: 'Git submodules',
    gitignore: 'Paths that the tracked .gitignore files leave out',
} as const;

// javascript sources
export const ESLINT_SETTINGS_TABLE = 'tools.eslint';
// ESLint's message template prints a category whole, so a category opens the quote that formatRefusedImport closes.
export const IMPORT_RULE_CATEGORY = 'rule "';
export const NODE_SHEBANG_TAG = `${SHEBANG_TAG}node`;

// python docstrings
export const DOCSTRING_STYLES = ['google', 'numpy', 'sphinx'] as const;

// python packages
export const PYTHON_PACKAGE_FILE = '__init__.py';

// sql files
export const SQL_EXTENSION = '.sql';

// syntax findings
export const SYNTAX_RULE = 'syntax';

// tsc compiler
export const TSBUILDINFO_FLAG = '--tsBuildInfoFile';
export const TSCONFIG_TSBUILDINFO = 'tsconfig.tsbuildinfo';
export const TSC_BUILD_COMMAND = ['tsc', '-b'] as const;
export const TSC_COMPILER_INPUT_PATHS = ['baseUrl', 'rootDir', 'rootDirs', 'typeRoots'] as const;
export const TSC_CONFIG_INPUT_PATHS = ['extends', 'files', 'include', 'exclude'] as const;
export const TSC_PROJECT_COMMAND = ['tsc', '--noEmit', '-p'] as const;
export const TSC_REFERENCE_BUNDLE = 'output.js';
export const TSC_REFERENCE_OUTPUT_FOLDER = 'typescript';
export const TSC_UNFORMATTED_OUTPUT = ['--pretty', 'false'] as const;

// tsc compiler options
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
export const PATHS_BASE_OPTION = 'pathsBasePath';
export const STANDALONE_OPTIONS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
} as const;
export const TYPESCRIPT_DEFAULTS = { ...STANDALONE_OPTIONS, noEmit: true } as const;

// tsc projects
export const MISSING_MODULE_RULE = 'TS2307';
export const PARENT_TSCONFIG_SKIP = 'The tsconfig of a parent folder covers this project, and gspot checks it there.';
export const QUOTED_MODULE = /'(?<name>[^']+)'/u;
export const TSCONFIG_COPY_FOLDER = `${GSPOT_PATHS.configurations}/typescript`;
export const TYPESCRIPT_TAG = 'typescript';
export const TYPESCRIPT_TSCONFIG_CHECK = 'typescript/tsconfig';
