/** The package.json of the staged copy test. */
export const STAGED_PACKAGE_JSON = {
    name: 'snapshot-project',
    private: true,
    type: 'module',
    dependencies: { dependency: '1.0.0' },
} as const;
