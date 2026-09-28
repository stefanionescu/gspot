import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runProcess } from '#tests/support/cli/command.ts';
import { setKey, proposePolicy } from '#cli/policy/write.ts';

test('policy edits preserve trailing array commas without emitting unsupported inline-table commas', async () => {
    await using sandbox = await testdir();
    const original = '# Authored selection.\nversion = 1\nconfigurations = ["security",]\n';
    const entry = {
        rule: 'js/file-system-race',
        paths: ['fixture.js'],
        reason: 'A deliberate fixture owns its temporary files.',
    };
    const mutate = setKey('tools.codeql.false_positives', [entry]);
    const proposed = proposePolicy(sandbox.path, original, mutate);
    await createFileTree(sandbox.path, {
        'gspot.toml': proposed.text,
        'broken.toml': 'value = { key = "example", }\n',
    });
    const command = ['taplo', 'check', '--no-schema', '--no-auto-config'];
    const valid = await runProcess([...command, 'gspot.toml'], { cwd: sandbox.path });
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(proposed.text).toContain('# Authored selection.');
    expect(proposed.policy.tools['codeql']?.['false_positives']).toStrictEqual([entry]);
    const repeated = proposePolicy(sandbox.path, proposed.text, mutate);
    expect(repeated.changed).toBe(false);
    expect(repeated.text).toBe(proposed.text);
    const invalid = await runProcess([...command, join(sandbox.path, 'broken.toml')], { cwd: sandbox.path });
    expect(invalid.code).toBe(1);
    expect(invalid.stderr).toContain('invalid TOML');
});
