import { parse } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';

import { readSettings } from '#cli/settings/read.ts';
import { findValueAt } from '#cli/system/tables.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/setup/configurations.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { initOutputSchema } from '#tests/setup/schemas.ts';

const IMPORT_STYLE_CASES = [
    {
        name: 'a tsconfig that imports .ts files by name',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"allowImportingTsExtensions":true,"noEmit":true}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'ts',
    },
    {
        name: 'an esbuild bundle',
        files: {
            'package.json': '{"private":true,"type":"module","devDependencies":{"esbuild":"0.25.0"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'extensionless',
    },
    {
        name: 'a Node.js package',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: undefined,
    },
] as const;

const WORKSPACE_SITE_FILES = {
    'package.json': '{"name":"root","private":true,"workspaces":["apps/*"]}',
    'source.ts': 'export const root = true;\n',
    'apps/site/package.json': '{"name":"site","private":true}',
    'apps/site/source.py': 'VALUE = 1\n',
} as const;

const SIMULATOR_DESTINATION = 'generic/platform=iOS Simulator';

test('the gspot.toml text keeps root and scope configurations', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox(WORKSPACE_SITE_FILES);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'typescript', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settingsText: text } = initOutputSchema.parse(JSON.parse(result.stdout));
    const settings = readSettings(text, sandbox.path);
    expect({ root: settings.configurations, site: settings.scopes.get('apps/site')?.configurations }).toStrictEqual({
        root: ['typescript'],
        site: ['python'],
    });
});

test('init finds the Xcode project of the scope and picks the destination from its SDKROOT', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    const source = BUILD_SETTINGS_PBXPROJ.replace('SDKROOT=macosx', 'SDKROOT=iphoneos');
    await using sandbox = await createGitSandbox({ 'App.xcodeproj/project.pbxproj': source });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'swift,xcode', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(parse(output.settingsText)).toMatchObject({
        swift: { xcode_project: 'App.xcodeproj', xcode_destination: SIMULATOR_DESTINATION },
    });
});

test('init finds the next-intl messages folder', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"dependencies":{"next-intl":"4.0.0"}}',
        'messages/en.json': '{"title":"Shop"}\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(parse(output.settingsText)).toMatchObject({ translations: { messages_folder: 'messages' } });
});

test.each([...IMPORT_STYLE_CASES])('init writes the import style of $name', async ({ files, expected }) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox(files);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(findValueAt(parse(output.settingsText), ['javascript', 'import_extension'])).toBe(expected);
});

test.each([
    ["import { value } from './value.ts';\n", 'ts'],
    ["import { value } from './value';\n", undefined],
])('a tsconfig that allows .ts imports wins over React only when the imports use .ts: %j', async (source, expected) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"type":"module","dependencies":{"react":"19.1.1"}}',
        'tsconfig.json': '{"compilerOptions":{"allowImportingTsExtensions":true,"noEmit":true}}',
        'src/main.ts': source,
        'src/value.ts': 'export const value = 1;\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(findValueAt(parse(output.settingsText), ['javascript', 'import_extension'])).toBe(expected);
});

test('a nodenext tsconfig wins over the React import extension', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"workspaces":["packages/ui"]}',
        'packages/ui/package.json': '{"private":true,"type":"module","dependencies":{"react":"19.1.1"}}',
        'packages/ui/tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
        'packages/ui/src/button.tsx': 'export const Button = () => null;\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settingsText: text } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(parse(text)).toMatchObject({
        scope: [{ path: 'packages/ui', javascript: { import_extension: 'js' } }],
    });
});
