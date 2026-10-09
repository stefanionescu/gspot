/** Each workspace declaration carries its native malformed-input diagnostic. */
export const INVALID_WORKSPACE_CASES = [
    { path: 'pnpm-workspace.yaml', parseError: 'Flow map must end with a }' },
    { path: 'lerna.json', parseError: "JSON Parse error: Expected '}'" },
    {
        path: 'rush.json',
        parseError: 'Invalid JSON configuration at offset 1: CloseBraceExpected.',
    },
];
