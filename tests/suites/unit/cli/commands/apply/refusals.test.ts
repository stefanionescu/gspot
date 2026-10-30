import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlink, readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { PIN_MESSAGE } from '#tests/config/version-pin.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { readTree, isOnDisk } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { ROOT_EDITORCONFIG } from '#tests/config/commands/contents.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { LINKED_FILE_CASES } from '#tests/config/commands/apply/refusals.ts';

test('a broken managed block stops apply before generated files change', async () => {
    await using sandbox = await createGitSandbox({});
    const authored = `# Preserve this file
<!-- >>> gspot managed >>> -->
Unclosed instructions.
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toBe(
        'AGENTS.md has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.\n',
    );
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    const exists = await isOnDisk(join(sandbox.path, getManifestTarget('bash', 'shellcheckrc')));
    expect(exists).toBe(false);
});

test('apply --json prints one error object when an unowned file blocks generation', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
        '.editorconfig': ROOT_EDITORCONFIG,
    });
    const refused = await runGspot(sandbox.path, ['apply', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const failure = JSON.parse(refused.stdout) as CommandFailureJson;
    expect(failure).toStrictEqual({
        error: 'writing',
        message: 'gspot did not overwrite these files: .editorconfig. Move them aside, then run the command again.',
    });
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).toBe(ROOT_EDITORCONFIG);
});

test('a malformed reason reports a settings error and apply preserves the authored settings', async () => {
    await using sandbox = await createGitSandbox({});
    const source = buildSandboxSettings(['site'], {
        tables: '[limits]\nfile_lines = { value = 1000, reason = 42 }\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const message =
        'gspot.toml:4: limits.file_lines.reason: The value 42 is not valid for limits.file_lines.reason. Use a valid string value: Why this code needs more than the default; required when you raise the value.';
    const checked = await runGspot(sandbox.path, ['check', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(JSON.parse(checked.stdout)).toStrictEqual({ error: 'settings', message });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stdout + applied.stderr).toBe(
        'gspot.toml:4: limits.file_lines.reason: The value 42 is not valid for limits.file_lines.reason. Use a valid string value: Why this code needs more than the default; required when you raise the value.\n',
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(await isOnDisk(join(sandbox.path, GSPOT_FOLDER))).toBe(false);
});

test.each([...LINKED_FILE_CASES])(
    'apply --dry-run refuses a $path that links outside the repository and writes nothing',
    async ({ path, outside, files, message }) => {
        await using sandbox = await testdir({
            ...files,
            'project/.gspot/configurations/.keep': '',
            outside,
        });
        const project = join(sandbox.path, 'project');
        runGitStep(project, ['init', '--quiet']);
        await symlink(join(sandbox.path, 'outside'), join(project, path));
        const refused = await runGspot(project, ['apply', '--dry-run']);
        expect(refused.code).toBe(2);
        expect(refused.stderr).toBe(`${message}\n`);
        expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
    },
);

test('apply refuses a newer pin and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/version': '9.9.9\n',
        '.gspot/preserve.txt': 'keep generated content',
    });
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, ['apply', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout) as CommandFailureJson).toStrictEqual({ error: 'pin', message: PIN_MESSAGE });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
