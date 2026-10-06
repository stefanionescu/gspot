export const KEY = 'custom"key\\name\ncafé';
export const VALUE = 'yes: # quoted "value"';
export const PROJECT = 'ios/App: # café.xcodeproj';
export const SCHEME = 'null';
export const REGISTRIES = ['null', 'registry.example.com:5000'];

export const SERIALIZATION_POLICY = {
    configurations: ['typescript', 'format', 'markdown', 'files', 'docker', 'swift', 'xcode'],
    tools: {
        prettier: { verbatim: { reason: 'An upstream option.', [KEY]: VALUE } },
        knip: { verbatim: { reason: 'An upstream option.', [KEY]: VALUE } },
        markdownlint: { rules: { MD044: { names: [KEY, VALUE] } } },
        yamllint: { rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } } },
        xcode: { project: PROJECT, scheme: SCHEME },
        hadolint: { trusted_registries: REGISTRIES },
    },
};

export const SERIALIZATION_FILES = {
    'package.json': '{"name":"serialization-fixture","private":true,"type":"module"}',
    'sample.ts': 'export const value = 1;',
    'sample.md': '# Sample',
    Dockerfile: 'FROM alpine:3.22',
    'sample.yaml': 'value: true',
    'Sample.swift': 'let value = 1',
};

/** Uniform Resource Identifier delimiters and Unicode must remain literal module target names. */
export const MODULE_TARGETS = ['100%', '#fragment', '?query', "author's", 'café'];
export const MODULE_VALUE = { location: 'the requested module' };
