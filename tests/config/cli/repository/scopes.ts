/** Each workspace declaration supplies its native valid replacement after malformed input is refused. */
export const INVALID_WORKSPACE_CASES = [
    { path: 'pnpm-workspace.yaml', parseError: 'Flow map must end with a }', content: '{"packages":["packages/*"]}' },
    { path: 'lerna.json', parseError: "JSON Parse error: Expected '}'", content: '{"packages":["packages/*"]}' },
    {
        path: 'rush.json',
        parseError: 'Invalid JSON configuration at offset 1: CloseBraceExpected.',
        content: '{"projects":[{"packageName":"app","projectFolder":"packages/app"}]}',
    },
];
