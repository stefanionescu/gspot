import { projectFolder } from '#cli/repository/scopes.ts';
import { expect, test } from 'bun:test';

test.each([
    ['api/package.json', 'package.json', 'api'],
    ['package.json', 'package.json', ''],
    ['services/billing/requirements-dev.txt', 'requirements*.txt', 'services/billing'],
    ['ios/App.xcodeproj/project.pbxproj', '*.xcodeproj', 'ios'],
    ['apps/web/supabase/config.toml', 'supabase/config.toml', 'apps/web'],
    ['supabase/config.toml', 'supabase/config.toml', ''],
])('%s with the project file %s marks the folder %j', (path, pattern, folder) => {
    expect(projectFolder(path, pattern)).toBe(folder);
});

test.each([
    ['api/package-lock.json', 'package.json'],
    ['docs/supabase.md', 'supabase/config.toml'],
    ['ios/App.xcworkspace/contents.xcworkspacedata', '*.xcodeproj'],
    ['requirements.txt.bak', 'requirements*.txt'],
])('%s is no project file for %s', (path, pattern) => {
    expect(projectFolder(path, pattern)).toBeUndefined();
});
