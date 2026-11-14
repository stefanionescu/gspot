import { test, expect } from 'bun:test';
import { findValueAt } from '#cli/system/tables.ts';
import { planSandboxInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/setup/configurations.ts';

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

const SIMULATOR_DESTINATION = 'generic/platform=iOS Simulator';

test('init finds the Xcode project of the scope and picks the destination from its SDKROOT', async () => {
    const source = BUILD_SETTINGS_PBXPROJ.replace('SDKROOT=macosx', 'SDKROOT=iphoneos');
    await using sandbox = await createGitSandbox({ 'App.xcodeproj/project.pbxproj': source });
    const { settings } = await planSandboxInit(sandbox.path, [
        '--configurations',
        'swift',
        '--configurations',
        'xcode',
    ]);
    expect(settings).toMatchObject({
        swift: { xcode_project: 'App.xcodeproj', xcode_destination: SIMULATOR_DESTINATION },
    });
});

test('init finds the next-intl messages folder', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"dependencies":{"next-intl":"4.0.0"}}',
        'messages/en.json': '{"title":"Shop"}\n',
    });
    const { settings } = await planSandboxInit(sandbox.path);
    expect(settings).toMatchObject({ translations: { messages_folder: 'messages' } });
});

test.each([...IMPORT_STYLE_CASES])('init writes the import style of $name', async ({ files, expected }) => {
    await using sandbox = await createGitSandbox(files);
    const { settings } = await planSandboxInit(sandbox.path);
    expect(findValueAt(settings, ['javascript', 'import_extension'])).toBe(expected);
});

test.each([
    ["import { value } from './value.ts';\n", 'ts'],
    ["import { value } from './value';\n", undefined],
])('a tsconfig that allows .ts imports wins over React only when the imports use .ts: %j', async (source, expected) => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"type":"module","dependencies":{"react":"19.1.1"}}',
        'tsconfig.json': '{"compilerOptions":{"allowImportingTsExtensions":true,"noEmit":true}}',
        'src/main.ts': source,
        'src/value.ts': 'export const value = 1;\n',
    });
    const { settings } = await planSandboxInit(sandbox.path);
    expect(findValueAt(settings, ['javascript', 'import_extension'])).toBe(expected);
});

test('a nodenext tsconfig wins over the React import extension', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"workspaces":["packages/ui"]}',
        'packages/ui/package.json': '{"private":true,"type":"module","dependencies":{"react":"19.1.1"}}',
        'packages/ui/tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
        'packages/ui/src/button.tsx': 'export const Button = () => null;\n',
    });
    const { settings } = await planSandboxInit(sandbox.path);
    expect(settings).toMatchObject({
        scope: [{ path: 'packages/ui', javascript: { import_extension: 'js' } }],
    });
});
