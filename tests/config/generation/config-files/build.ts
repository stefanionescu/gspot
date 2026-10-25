export const SPECIAL_CHARACTER_FILES = {
    'package.json': '{"name":"serialization-sample","private":true,"type":"module"}',
    'sample.ts': 'export const value = 1;',
    'sample.md': '# Sample',
    Dockerfile: 'FROM alpine:3.22',
    'sample.yaml': 'value: true',
    'Sample.swift': 'let value = 1',
} as const;

export const SPECIAL_CHARACTER_SETTINGS = {
    configurations: ['typescript', 'format', 'markdown', 'data-files', 'docker', 'swift', 'xcode'],
    tools: {
        markdownlint: { rules: { MD044: { names: ['custom"key\\name\ncafé', 'yes: # quoted "value"'] } } },
        yamllint: { rules: { truthy: { 'allowed-values': ['yes', 'no'] } } },
        hadolint: { trusted_registries: ['null', 'registry.example.com:5000'] as const },
    },
    swift: {
        xcode_project: 'ios/App # café.xcodeproj',
        xcode_scheme: 'null',
    },
} as const;
