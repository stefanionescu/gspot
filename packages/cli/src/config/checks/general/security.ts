export const CODEQL = 'codeql';

export const CODEQL_ANALYZE_FLAGS = ['--download', '--format=sarif-latest'] as const;
export const CODEQL_LANGUAGES_COMMAND = [
    'resolve',
    'languages',
    '--format=betterjson',
    '--filter-to-languages-with-queries',
] as const;
export const CODEQL_SUITES = { recommended: 'security-extended', all: 'security-and-quality' } as const;

export const SEMGREP_TOOL = 'semgrep';
export const RULES_KEY = 'rules';
