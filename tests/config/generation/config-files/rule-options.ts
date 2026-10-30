export const INACTIVE_RULE_OPTIONS = [
    {
        configuration: 'markdown',
        rule: 'MD013',
        tables: '[tools.markdownlint.rules.MD013]\nline_length = 100\n',
        scoped: false,
        message: 'gspot runs MD013 at no level, so it takes no options.',
    },
    {
        configuration: 'commits',
        rule: 'scope-case',
        tables: '[tools.commitlint.rules]\nscope-case = ["always", "upper-case"]\n',
        scoped: true,
        message: 'gspot runs scope-case at no level, so it takes no options.',
    },
    {
        configuration: 'data-files',
        rule: 'line-length',
        tables: '[tools.yamllint.rules.line-length]\nmax = 100\n',
        scoped: false,
        message:
            'gspot.toml:3: tools.yamllint.rules.line-length: Unknown yamllint rule. Accepted rules: anchors, key-duplicates, octal-values, truthy.',
    },
] as const;
