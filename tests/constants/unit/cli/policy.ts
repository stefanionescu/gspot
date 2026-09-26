// The literal values unit/cli/policy reads: names, patterns, limits, and tables.

// A message speaks of a setting, a configuration, a scope, and a default; these are names of the code, not of the reader.
export const INTERNAL_WORDS = /\b(?:expose[sd]?|surface|layer|spec|schema)\b/iu;
export const SAMPLE_ARGUMENTS: Record<string, unknown[]> = {
    conflictingScalars: ['tools.sqlfluff.dialect', 'sql', 'postgres'],
    settingNotExposed: ['tools.shellcheck.severity', ['tools.shellcheck.rules']],
    settingInScope: ['tools.jest.coverage_lines', 'api'],
};
