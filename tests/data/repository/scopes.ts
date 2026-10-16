/** Each workspace declaration carries its native malformed-input diagnostic. */
export const INVALID_WORKSPACE_FILES = [
    { path: 'pnpm-workspace.yaml', parseError: 'Flow map must end with a }' },
    { path: 'lerna.json', parseError: "JSON Parse error: Expected '}'" },
    {
        path: 'rush.json',
        parseError: 'Unexpected end of input at 1:2',
    },
] as const;

/** Paths retain literal Unicode, punctuation, and empty root or scope prefixes. */
export const SCOPE_PATHS = [
    { scope: '', path: '', repositoryPath: '' },
    { scope: '', path: 'README.md', repositoryPath: 'README.md' },
    { scope: 'app', path: '', repositoryPath: 'app/' },
    { scope: 'app', path: 'package.json', repositoryPath: 'app/package.json' },
    { scope: 'packages/app', path: 'src/main.ts', repositoryPath: 'packages/app/src/main.ts' },
    { scope: 'apps/日本語 [web]', path: 'src/hello world.ts', repositoryPath: 'apps/日本語 [web]/src/hello world.ts' },
] as const;

export const PROJECT_FILE_FOLDERS = [
    ['api/package.json', 'package.json', 'api'],
    ['package.json', 'package.json', ''],
    ['services/billing/requirements-dev.txt', 'requirements*.txt', 'services/billing'],
    ['ios/App.xcodeproj/project.pbxproj', '*.xcodeproj', 'ios'],
    ['apps/web/supabase/config.toml', 'supabase/config.toml', 'apps/web'],
    ['supabase/config.toml', 'supabase/config.toml', ''],
] as const;

export const NOT_PROJECT_FILES = [
    ['api/package-lock.json', 'package.json'],
    ['docs/supabase.md', 'supabase/config.toml'],
    ['ios/App.xcworkspace/contents.xcworkspacedata', '*.xcodeproj'],
    ['requirements.txt.bak', 'requirements*.txt'],
] as const;

export const WORKSPACE_DECLARATIONS = [
    { 'package.json': '{"workspaces":["packages/*"]}' },
    { 'package.json': '{"workspaces":{"packages":["packages/*"]}}' },
    { 'package.json': '{}', 'pnpm-workspace.yaml': 'packages: ["packages/*"]' },
    { 'package.json': '{}', 'lerna.json': '{"packages":["packages/*"]}' },
    {
        'rush.json':
            '{"projects":[{"packageName":"api","projectFolder":"packages/api"},{"packageName":"lint","projectFolder":"packages/lint"}]}',
    },
] as const;
