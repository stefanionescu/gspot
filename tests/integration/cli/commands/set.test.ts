// What gspot set refuses, run through the command, and what set and ignore keep when apply stops after them.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/harness/cli/command.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';

const POLICY = 'kits = ["markdown", "structure"]\n[rules]\ninstall = false\n[[scope]]\npath = "api"\nkits = ["bash"]\n';

test.each([
    ['a scope-only key without --scope', ['set', 'tools.bash.boundary_roots', 'scripts'], '--scope api'],
    ['a tool rule turned off', ['set', 'tools.markdownlint.rules', '{"MD013": "off"}'], 'gspot ignore'],
    ['a key without a value', ['set', 'limits.file_lines'], 'needs a value'],
    ['an undeclared scope', ['set', 'limits.file_lines', '100', '--scope', 'web'], 'web'],
])('set refuses %s', async (_, argv, expected) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'api/entry.sh': 'echo api\n',
        'web/index.md': '# Web\n',
    });
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain(expected);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(POLICY);
});

test.each([
    ['set', ['set', 'limits.bash.file_lines', '200'], '[limits.bash]\nfile_lines = 200'],
    [
        'ignore',
        ['ignore', 'bash/shellcheck', '--paths', 'entry.sh', '--reason', 'Generated from its template.'],
        'check = "bash/shellcheck"',
    ],
])('%s keeps its change in gspot.toml and exits 2 when apply then stops', async (_, argv, written) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'kits = ["bash", "structure"]\n[rules]\ninstall = false\n',
        'entry.sh': 'echo example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(sandbox.path, '.gspot/config/shellcheckrc');
    chmodSync(generated, 0o644);
    writeFileSync(generated, `${readFileSync(generated, 'utf8')}# Edited.\n`);
    const stopped = await runGspot(sandbox.path, argv);
    expect(stopped.code, stopped.stdout + stopped.stderr).toBe(2);
    expect(stopped.stdout).toContain('gspot.toml keeps this change');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain(written);
});
