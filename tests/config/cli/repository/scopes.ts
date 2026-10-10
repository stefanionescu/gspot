/** Each workspace declaration carries its native malformed-input diagnostic. */
export const INVALID_WORKSPACE_CASES = [
    { path: 'pnpm-workspace.yaml', parseError: 'Flow map must end with a }' },
    { path: 'lerna.json', parseError: "JSON Parse error: Expected '}'" },
    {
        path: 'rush.json',
        parseError: 'Invalid JSON configuration at offset 1: CloseBraceExpected.',
    },
];

/** Paths retain literal Unicode, punctuation, and empty root or scope prefixes. */
export const SCOPE_PATH_CASES = [
    { scope: '', path: '', repositoryPath: '' },
    { scope: '', path: 'README.md', repositoryPath: 'README.md' },
    { scope: 'app', path: '', repositoryPath: 'app/' },
    { scope: 'app', path: 'package.json', repositoryPath: 'app/package.json' },
    { scope: 'packages/app', path: 'src/main.ts', repositoryPath: 'packages/app/src/main.ts' },
    { scope: 'apps/日本語 [web]', path: 'src/hello world.ts', repositoryPath: 'apps/日本語 [web]/src/hello world.ts' },
];
