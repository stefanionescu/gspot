import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { findValueAt } from '#cli/system/tables.ts';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import type { InitJson } from '#cli/types/commands/edits.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/setup/configurations.ts';
import { IMPORT_STYLE_CASES, WORKSPACE_SITE_FILES, SIMULATOR_DESTINATION } from '#tests/config/generation/settings.ts';

test('the gspot.toml text keeps root and scope configurations', async () => {
    await using sandbox = await createGitSandbox(WORKSPACE_SITE_FILES);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'typescript', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settingsText: text } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settingsText'>>;
    const settings = readSettings(text, sandbox.path);
    expect({ root: settings.configurations, site: settings.scopes.get('apps/site')?.configurations }).toStrictEqual({
        root: ['typescript'],
        site: ['javascript', 'python'],
    });
});

test('init finds the Xcode project of the scope and picks the destination from its SDKROOT', async () => {
    const source = BUILD_SETTINGS_PBXPROJ.replace('SDKROOT=macosx', 'SDKROOT=iphoneos');
    await using sandbox = await createGitSandbox({ 'App.xcodeproj/project.pbxproj': source });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'swift,xcode', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settingsText'>>;
    expect(parse(output.settingsText)).toMatchObject({
        swift: { xcode_project: 'App.xcodeproj', xcode_destination: SIMULATOR_DESTINATION },
    });
    expect(await readFile(`${sandbox.path}/App.xcodeproj/project.pbxproj`, 'utf8')).toBe(source);
});

test.each([...IMPORT_STYLE_CASES])('init writes the import style of $name', async ({ files, expected }) => {
    await using sandbox = await createGitSandbox(files);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settingsText'>>;
    expect(findValueAt(parse(output.settingsText), ['javascript', 'import_extension'])).toBe(expected);
});

test('a nodenext tsconfig wins over the React import extension', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"workspaces":["packages/ui"]}',
        'packages/ui/package.json': '{"private":true,"type":"module","dependencies":{"react":"19.1.1"}}',
        'packages/ui/tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
        'packages/ui/src/button.tsx': 'export const Button = () => null;\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settingsText: text } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settingsText'>>;
    expect(parse(text)).toMatchObject({
        scope: [{ path: 'packages/ui', javascript: { import_extension: 'js' } }],
    });
});
