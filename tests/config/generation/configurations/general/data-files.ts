/** The catalog entry of the custom schema. */
export const MAPPED_SCHEMA_ENTRIES = [
    {
        name: 'https://example.com/schema.json',
        fileMatch: ['custom.json'],
        location: 'https://example.com/schema.json',
    },
] as const;

/** A custom v8r schema. */
export const MAPPED_SCHEMAS = [
    {
        paths: ['custom.json'],
        url: 'https://example.com/schema.json',
    },
] as const;
