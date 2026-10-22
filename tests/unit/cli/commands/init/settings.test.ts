import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { getValueAt } from '#cli/system/tables.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/data/checks/xcode.ts';
import { runGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';

import {
    LINT_JOBS,
    IMPORT_STYLE_CASES,
    CI_PREFERENCE_CASES,
    WORKSPACE_SITE_FILES,
} from '#tests/data/commands/init/settings.ts';

test.each([...CI_PREFERENCE_CASES])(
    'init proposes the CI provider from $name',
    async ({ tracked, untracked, remote, provider }) => {
        await using sandbox = await testdir(Object.fromEntries(tracked.map((file) => [file, '{}\n'])));

        runGitStep(sandbox.path, ['init', '-q']);
        if (tracked.length > 0) runGitStep(sandbox.path, ['add', '--', ...tracked]);
        if (untracked !== '') await createFileTree(sandbox.path, { [untracked]: '{}\n' });
        runGitStep(sandbox.path, ['config', 'remote.origin.url', remote]);
        const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings'>>;
        expect(parseSettings(output.settings, undefined).ci?.provider).toBe(provider);
    },
);

test('the gspot.toml text keeps root and scope configurations', async () => {
    await using sandbox = await testdir(WORKSPACE_SITE_FILES);
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
