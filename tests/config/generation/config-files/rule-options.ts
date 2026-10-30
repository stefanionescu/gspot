export const INACTIVE_RULE_OPTIONS = [
    {
        configuration: 'markdown',
        rule: 'MD013',
        tables: '[tools.markdownlint.rules.MD013]\nline_length = 100\n',
        message: 'gspot runs MD013 at no level, so it takes no options.',
    },
    {
        configuration: 'data-files',
        rule: 'line-length',
        tables: '[tools.yamllint.rules.line-length]\nmax = 100\n',
        message:
            'gspot.toml:3: tools.yamllint.rules.line-length: There is no yamllint rule called line-length. The yamllint rules are anchors, key-duplicates, octal-values, truthy.',
    },
] as const;
