export const MAPPED_SCHEMA_RECORDS = [
    {
        name: 'https://example.com/schema.json',
        fileMatch: ['custom.json'],
        location: 'https://example.com/schema.json',
    },
] as const;

export const MAPPED_SCHEMAS = [
    {
        paths: ['custom.json'],
        url: 'https://example.com/schema.json',
    },
] as const;
