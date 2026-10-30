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
