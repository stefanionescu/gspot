/** Each workspace declaration supplies its native valid replacement after malformed input is refused. */
export const INVALID_WORKSPACE_CASES = [
    { path: 'pnpm-workspace.yaml', content: '{"packages":["packages/*"]}' },
    { path: 'lerna.json', content: '{"packages":["packages/*"]}' },
    { path: 'rush.json', content: '{"projects":[{"packageName":"app","projectFolder":"packages/app"}]}' },
];
