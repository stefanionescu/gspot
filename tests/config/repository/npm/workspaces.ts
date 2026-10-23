export const INVALID_WORKSPACE_FILES = [
    {
        path: 'pnpm-workspace.yaml',
        parseError:
            'pnpm-workspace.yaml is not a valid workspace file: Flow map must end with a } at line 1, column 2:\n\n{\n ^\n. Fix the file.',
    },
    {
        path: 'lerna.json',
        parseError: "lerna.json is not a valid workspace file: JSON Parse error: Expected '}'. Fix the file.",
    },
    {
        path: 'rush.json',
        parseError: 'rush.json is not a valid workspace file: Unexpected end of input at 1:2\n{\n ^. Fix the file.',
    },
] as const;

export const INACTIVE_LERNA_FILES = {
    'package.json': '{}',
    'pnpm-workspace.yaml': 'packages: ["packages/*"]\n',
    'lerna.json': 'malformed inactive configuration',
    'packages/app/package.json': '{"name":"inside"}',
} as const;

export const NESTED_WORKSPACE_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'pnpm-workspace.yaml': 'packages: ["packages/*"]',
    'packages/parent/package.json': '{"name":"parent"}',
    'child/package.json': '{}',
    'empty/source.py': '',
} as const;

export const OUTSIDE_WORKSPACE_FILES = [
    ['pnpm-workspace.yaml', 'packages: ["../outside"]\n', '../outside'],
    ['rush.json', '{"projects":[{"packageName":"outside","projectFolder":"packages/linked"}]}', 'packages/linked'],
] as const;
