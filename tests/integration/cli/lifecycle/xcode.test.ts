// Init fills the Xcode project setting only when a kit selected for its scope declares that setting.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { QUIET_INIT } from '#tests/inputs/cli.ts';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';

test.each([
    { selection: ['xcode', '--without', 'swift'], written: false },
    { selection: ['swift', 'xcode'], written: true },
])('init with $selection writes the detected Xcode project: $written', async ({ selection, written }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'App.xcodeproj/project.pbxproj': '// !$*UTF8*$!\n{}\n',
        'App/Home.swift': 'let home = 1\n',
    });
    commitAll(sandbox.path);
    const initialized = await run(sandbox.path, ['init', '--yes', '--kits', ...selection, ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8').includes('project = "App.xcodeproj"')).toBe(written);
});
