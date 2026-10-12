export const ODD_KEY = 'custom"key\\name\ncafé';

export const ODD_VALUE = 'yes: # quoted "value"';

export const XCODE_PROJECT = 'ios/App # café.xcodeproj';

export const XCODE_SCHEME = 'null';

export const REGISTRIES = ['null', 'registry.example.com:5000'] as const;

export const ODD_VALUE_SETTINGS = {
    configurations: ['typescript', 'format', 'markdown', 'files', 'docker', 'swift', 'xcode'],
    xcode: { project: XCODE_PROJECT, scheme: XCODE_SCHEME },
    tools: {
        prettier: { extra: { value: { [ODD_KEY]: ODD_VALUE }, reason: 'An upstream option.' } },
        knip: { extra: { value: { [ODD_KEY]: ODD_VALUE }, reason: 'An upstream option.' } },
        markdownlint: { rules: { MD044: { names: [ODD_KEY, ODD_VALUE] } } },
        yamllint: { rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } } },
        hadolint: { trusted_registries: REGISTRIES },
    },
} as const;

export const ODD_VALUE_FILES = {
    'package.json': '{"name":"serialization-fixture","private":true,"type":"module"}',
    'sample.ts': 'export const value = 1;',
    'sample.md': '# Sample',
    Dockerfile: 'FROM alpine:3.22',
    'sample.yaml': 'value: true',
    'Sample.swift': 'let value = 1',
} as const;

/** Uniform Resource Identifier delimiters and Unicode must remain literal module target names. */
export const MODULE_TARGETS = ['100%', '#fragment', '?query', "author's", 'café'] as const;

export const MODULE_VALUE = { location: 'the requested module' } as const;
