export const SPECIAL_CHARACTER_KEY = 'custom"key\\name\ncafé';

export const SPECIAL_CHARACTER_VALUE = 'yes: # quoted "value"';

export const XCODE_PROJECT = 'ios/App # café.xcodeproj';

export const XCODE_SCHEME = 'null';

export const REGISTRIES = ['null', 'registry.example.com:5000'] as const;

export const SPECIAL_CHARACTER_FILES = {
    'package.json': '{"name":"serialization-fixture","private":true,"type":"module"}',
    'sample.ts': 'export const value = 1;',
    'sample.md': '# Sample',
    Dockerfile: 'FROM alpine:3.22',
    'sample.yaml': 'value: true',
    'Sample.swift': 'let value = 1',
} as const;

export const SPECIAL_CHARACTER_SETTINGS = {
    configurations: ['typescript', 'format', 'markdown', 'data-files', 'docker', 'swift', 'xcode'],
    tools: {
        markdownlint: { rules: { MD044: { names: [SPECIAL_CHARACTER_KEY, SPECIAL_CHARACTER_VALUE] } } },
        yamllint: { rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } } },
        hadolint: { trusted_registries: REGISTRIES },
    },
    swift: {
        xcode_project: XCODE_PROJECT,
        xcode_scheme: XCODE_SCHEME,
    },
} as const;
