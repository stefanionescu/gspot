import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { isOnDisk } from '#tests/setup/files.ts';
import { getValueAt } from '#cli/system/values.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/data/checks/xcode.ts';
import { LINT_JOBS, IMPORT_STYLE_CASES, CI_PREFERENCE_CASES } from '#tests/data/commands/init.ts';

test.each([...CI_PREFERENCE_CASES])(
    'init proposes the CI provider from %s',
    async (_label, ci, path, remote, expected) => {
        await using sandbox = await testdir(Object.fromEntries(ci.map((file) => [file, '{}\n'])));

        readGitOutput(sandbox.path, ['init', '-q']);
        if (ci.length > 0) readGitOutput(sandbox.path, ['add', '--', ...ci]);
        if (path !== '') await createFileTree(sandbox.path, { [path]: '{}\n' });
        readGitOutput(sandbox.path, ['config', 'remote.origin.url', remote]);
        const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
        if (expected === 'none') expect(parse(output.settings)).not.toHaveProperty('ci');
        else
            expect(parseSettings(output.settings, undefined).ci).toMatchObject({
                enabled: true,
                provider: expected,
            });
    },
);

test('the gspot.toml text keeps root and scope configurations', async () => {
    await using sandbox = await testdir({
        'package.json': '{"name":"root","private":true,"workspaces":["apps/*"]}',
        'source.ts': 'export const root = true;\n',
        'apps/site/package.json': '{"name":"site","private":true}',
        'apps/site/source.py': 'VALUE = 1\n',
    });
    const result = await runGspot(sandbox.path, [...buildInitArguments(['typescript'], { json: true }), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { settings: text } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    const settings = parseSettings(text, undefined);
    expect(settings.configurations).toContain('typescript');
    expect(settings.scopes['apps/site']?.configurations).toContain('python');
    expect(await isOnDisk(`${sandbox.path}/gspot.toml`)).toBe(false);
});

test('init finds the Xcode project of the scope and picks the destination from its SDKROOT', async () => {
    const source = BUILD_SETTINGS_PBXPROJ.replace('SDKROOT=macosx', 'SDKROOT=iphoneos');
    await using sandbox = await testdir({ 'App.xcodeproj/project.pbxproj': source });
    const result = await runGspot(sandbox.path, [
        ...buildInitArguments(['swift', 'xcode'], { json: true }),
        '--dry-run',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    expect(parse(output.settings)).toMatchObject({
        swift: { xcode_project: 'App.xcodeproj', xcode_destination: 'generic/platform=iOS Simulator' },
    });
    expect(await readFile(`${sandbox.path}/App.xcodeproj/project.pbxproj`, 'utf8')).toBe(source);
});

test.each([...LINT_JOBS])(
    'a lint job in $name means init asks no CI question and proposes no CI',
    async ({ path, content }) => {
        await using sandbox = await testdir({ [path]: content });
        const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
        expect(parse(output.settings)).not.toHaveProperty('ci');
    },
);

test.each([...IMPORT_STYLE_CASES])('init writes the import style of $name', async ({ files, expected }) => {
    await using sandbox = await testdir(files);
    const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
    expect(getValueAt(parse(output.settings), ['tools', 'eslint', 'import_extension'])).toBe(expected);
});
