export const CONFIG_FILE_PATTERNS = ['**/*.config.*', '**/.*rc.*', '**/Package.swift', '**/setup.py'] as const;

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

export const UNCOVERED_FILE_MESSAGE =
    'No [[import_rule]] covers this file. Add a path that matches it to an import rule, or record an [[ignore]] for structure/import-rules with its paths and a reason.';

export const PYTHON_SOURCE_ROOTS = ['', 'src'] as const;

export const PYTHON_EXTENSIONS = ['.py', '.pyi'] as const;

export const IMPORT_RULES_SKIP = 'Add [[import_rule]] records to check imports.';

export const PYTHON_MODULE_SUFFIXES = ['.py', '.pyi', '/__init__.py', '/__init__.pyi'] as const;

export const PYTHON_IMPORT_STATEMENT = 'import_statement';

export const PYTHON_FROM_STATEMENT = 'import_from_statement';

export const RELATIVE_IMPORT = 'relative_import';

export const RULES = { uncoveredFile: 'uncovered-file', refusedImport: 'refused-import' } as const;
