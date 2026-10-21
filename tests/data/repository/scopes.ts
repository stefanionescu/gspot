/** Each workspace file with the file error that gspot reports. */
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

/** Paths keep literal Unicode, punctuation, and empty root or scope prefixes. */
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
    ['api/package-lock.json', 'package.json', undefined],
    ['docs/supabase.md', 'supabase/config.toml', undefined],
    ['ios/App.xcworkspace/contents.xcworkspacedata', '*.xcodeproj', undefined],
    ['requirements.txt.bak', 'requirements*.txt', undefined],
] as const;

export const WORKSPACE_FILE_CASES = [
    { 'package.json': '{"workspaces":["packages/*"]}' },
    { 'package.json': '{"workspaces":{"packages":["packages/*"]}}' },
    { 'package.json': '{}', 'pnpm-workspace.yaml': 'packages: ["packages/*"]' },
    { 'package.json': '{}', 'lerna.json': '{"packages":["packages/*"]}' },
    {
        'rush.json':
            '{"projects":[{"packageName":"api","projectFolder":"packages/api"},{"packageName":"lint","projectFolder":"packages/lint"}]}',
    },
] as const;
