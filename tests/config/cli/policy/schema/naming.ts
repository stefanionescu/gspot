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
];
