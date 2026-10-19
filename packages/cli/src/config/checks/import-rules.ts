export const IMPORT_RULE_EXTENSIONS = [
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.py',
    '.pyi',
    '.swift',
] as const;

export const TOOL_SETTINGS_FILES = ['**/*.config.*', '**/.*rc.*', '**/Package.swift', '**/setup.py'] as const;

export const PYTHON_EXTENSIONS = ['.py', '.pyi'] as const;

export const PYTHON_MODULE_SUFFIXES = ['.py', '.pyi', '/__init__.py', '/__init__.pyi'] as const;

export const PYTHON_SOURCE_ROOTS = ['', 'src'] as const;

export const PYTHON_IMPORT_STATEMENT = 'import_statement';
export const PYTHON_FROM_STATEMENT = 'import_from_statement';
export const RELATIVE_IMPORT = 'relative_import';
export const SWIFT_IMPORT_NODE = 'import_declaration';

/** The folders where SwiftPM looks for a target without a path, in its order, by target kind. */
export const SWIFTPM_TARGET_FOLDERS: Readonly<Record<string, readonly string[]>> = {
    target: ['Sources', 'Source', 'src', 'srcs'],
    executableTarget: ['Sources', 'Source', 'src', 'srcs'],
    macro: ['Sources', 'Source', 'src', 'srcs'],
    testTarget: ['Tests', 'Sources', 'Source', 'src', 'srcs'],
    plugin: ['Plugins'],
};

/** Characters that Xcode replaces with an underscore in the module name of a target. */
export const SWIFT_MODULE_NAME_CHARACTERS = /\W/gu;

export const IMPORT_RULES_SKIP = 'Add [[import_rule]] records to check imports.';

export const UNCOVERED_FILE_MESSAGE =
    'No [[import_rule]] covers this file. Add a path that matches it to an import rule, or record an [[ignore]] for structure/import-rules with its paths and a reason.';
