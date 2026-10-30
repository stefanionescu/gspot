import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { findValueAt } from '#cli/system/tables.ts';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { SIMULATOR_DESTINATION } from '#tests/config/xcode.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/checks/infrastructure/xcode.ts';
import { IMPORT_STYLE_CASES, WORKSPACE_SITE_FILES } from '#tests/config/commands/init/settings.ts';

test('the gspot.toml text keeps root and scope configurations', async () => {
    await using sandbox = await createGitSandbox(WORKSPACE_SITE_FILES);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--configurations', 'typescript', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settings: text } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    const settings = readSettings(text, sandbox.path);
    expect({ root: settings.configurations, site: settings.scopes.get('apps/site')?.configurations }).toStrictEqual({
        root: ['typescript'],
        site: ['javascript', 'python'],
    });
});

test('init finds the Xcode project of the scope and picks the destination from its SDKROOT', async () => {
    const source = BUILD_SETTINGS_PBXPROJ.replace('SDKROOT=macosx', 'SDKROOT=iphoneos');
    await using sandbox = await createGitSandbox({ 'App.xcodeproj/project.pbxproj': source });
    const result = await runGspot(sandbox.path, ['init', '--yes', '--configurations', 'swift', 'xcode', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    expect(parse(output.settings)).toMatchObject({
        swift: { xcode_project: 'App.xcodeproj', xcode_destination: SIMULATOR_DESTINATION },
    });
    expect(await readFile(`${sandbox.path}/App.xcodeproj/project.pbxproj`, 'utf8')).toBe(source);
});

test.each([...IMPORT_STYLE_CASES])('init writes the import style of $name', async ({ files, expected }) => {
    await using sandbox = await createGitSandbox(files);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    expect(findValueAt(parse(output.settings), ['tools', 'eslint', 'import_extension'])).toBe(expected);
});
