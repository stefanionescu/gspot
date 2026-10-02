// What gspot set refuses, run through the command: each refusal exits 2 and leaves gspot.toml byte for byte.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/harness/cli/command.ts';

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
