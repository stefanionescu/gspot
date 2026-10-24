export const NAMING_SCOPE_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [
        { path: 'api', configurations: ['javascript', 'naming'] },
        { path: 'web', configurations: ['javascript', 'naming'] },
    ],
} as const;

export const ALL_FILES_BASES = [
    { reference: '', message: 'Checked every file: the base ref is empty.' },
    { reference: '0'.repeat(40), message: 'Checked every file: the base is a new branch.' },
] as const;
