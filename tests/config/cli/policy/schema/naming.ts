import type { RuntimeSchemaCase } from '#tests/types/cli/policy/schema.ts';

/** Naming declarations validate identically in runtime and published schemas. */
export const NAMING_SCHEMA_CASES: RuntimeSchemaCase[] = [
    {
        name: 'allowed exact names with reasons',
        input: {
            configurations: ['naming'],
            naming: { allowed: { 'external-name': 'The external protocol fixes this exact name.' } },
        },
        valid: true,
    },
    {
        name: 'an allowed name list from the former format',
        input: {
            configurations: ['naming'],
            naming: { allowed: [{ name: 'externalName', reason: 'The external protocol fixes this exact name.' }] },
        },
        valid: false,
        diagnostic: 'gspot.toml: naming.allowed:',
    },
    {
        name: 'the former separate file allowance',
        input: { configurations: ['naming'], naming: { fixed_keys: [{ file: 'source.ts', names: ['externalName'] }] } },
        valid: false,
        diagnostic: 'gspot.toml: naming.fixed_keys:',
    },
    {
        name: 'the former naming path list',
        input: {
            configurations: ['naming'],
            naming: { paths: [{ paths: ['source.ts'], names: ['externalName'], skip: true }] },
        },
        valid: false,
        diagnostic: 'gspot.toml: naming.paths:',
    },
    {
        name: 'a path-selected allowed name',
        input: {
            configurations: ['naming'],
            naming: {
                overrides: [
                    {
                        paths: ['source.ts'],
                        allowed: ['externalName'],
                        reason: 'The external protocol fixes this exact name.',
                    },
                ],
            },
        },
        valid: true,
    },
    {
        name: 'reserved identifier categories',
        input: {
            configurations: ['naming'],
            naming: { reserved: { record: ['properties', 'directories'] } },
        },
        valid: true,
    },
    {
        name: 'free-text reserved use',
        input: {
            configurations: ['naming'],
            naming: { reserved: { record: ['API client message field'] } },
        },
        valid: false,
        diagnostic: 'gspot.toml: naming.reserved.record.0:',
    },
    {
        name: 'an inherited-object reserved use',
        input: { configurations: ['naming'], naming: { reserved: { record: ['constructor'] } } },
        valid: false,
        diagnostic: 'gspot.toml: naming.reserved.record.0:',
    },
    {
        name: 'an empty reserved use list',
        input: { configurations: ['naming'], naming: { reserved: { record: [] } } },
        valid: false,
        diagnostic: 'gspot.toml: naming.reserved.record:',
    },
    {
        name: 'repeated words in an exact external name',
        input: {
            configurations: ['naming'],
            naming: {
                overrides: [
                    {
                        paths: ['source.ts'],
                        names: ['userUser'],
                        allow_repeated_words: true,
                        reason: 'The external interface fixes this exact name.',
                    },
                ],
            },
        },
        valid: true,
    },
    {
        name: 'the obsolete repeated word key',
        input: {
            configurations: ['naming'],
            naming: { overrides: [{ paths: ['source.ts'], allow_duplicate_words: true }] },
        },
        valid: false,
        diagnostic: 'gspot.toml: `allow_duplicate_words` is not a setting gspot knows under [naming.overrides.0].',
    },
    {
        name: 'the obsolete naming rule table',
        input: { configurations: ['naming'], naming: { rules: [{ paths: ['source.ts'], skip: true }] } },
        valid: false,
        diagnostic: 'gspot.toml: naming.rules:',
    },
    {
        name: 'the obsolete naming prefix key',
        input: {
            configurations: ['naming'],
            naming: { overrides: [{ paths: ['source.ts'], structural_prefix: '^test_' }] },
        },
        valid: false,
        diagnostic: 'gspot.toml: `structural_prefix` is not a setting gspot knows under [naming.overrides.0].',
    },
    {
        name: 'the obsolete naming exclusion key',
        input: { configurations: ['naming'], naming: { overrides: [{ paths: ['source.ts'], exclude: true }] } },
        valid: false,
        diagnostic: 'gspot.toml: `exclude` is not a setting gspot knows under [naming.overrides.0].',
    },
    {
        name: 'a former exact-name exception list',
        input: { configurations: ['naming'], naming: { external: ['externalName'] } },
        valid: false,
        diagnostic: 'gspot.toml: naming.external:',
    },
    {
        name: 'the former naming group field',
        input: { configurations: ['naming'], naming: { dropped_groups: [] } },
        valid: false,
        diagnostic: 'gspot.toml: naming.dropped_groups:',
    },
    {
        name: 'the former protocol-key field',
        input: { configurations: ['naming'], naming: { protocol_keys: [] } },
        valid: false,
        diagnostic: 'gspot.toml: naming.protocol_keys:',
    },
];
