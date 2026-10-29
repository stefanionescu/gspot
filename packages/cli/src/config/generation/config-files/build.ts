import ts from 'typescript';

export const TRANSPILE_OPTIONS = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } as const;

export const SEMGREP_RULE_PACK_FILE = 'semgrep.yml';

export const CONFIG_FILE_REFERENCE = /(?:['"]\.\/|\bnew\s+URL\(\s*['"])(?<path>[^'"]+)['"]/gu;

export const TS_EXTENSION = '.ts';
