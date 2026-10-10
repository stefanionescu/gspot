import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { valueAt } from '#cli/platform/contracts.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';

test('ignores and loosened settings always require reasons and refusals preserve the policy', async () => {
    await using directory = await testdir();
    const policy = `configurations = ["bash"]\n[agent_rules]\nenabled = false\n`;
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'if then\n' });
    const ignored = await runGspot(directory.path, ['ignore', 'bash/bash-syntax']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(2);
    const loosened = await runGspot(directory.path, ['set', 'limits.file_lines', '400']);
    expect(loosened.code, loosened.stdout + loosened.stderr).toBe(2);
    // A refused write leaves the policy as it was; the ignore then needs its reason.
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    const explained = await runGspot(directory.path, [
        'ignore',
        'bash/bash-syntax',
        '--reason',
        'Reviewed independently.',
    ]);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    const checked = await checkReport(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = checked.report;
    expect(report.ignores[0]?.check).toBe('bash/bash-syntax');
    expect(report.ignores[0]?.matched).toBe(0);
    expect(report.ignores[0]?.reason).toBe('Reviewed independently.');
    expect(ignored.stdout + ignored.stderr).not.toContain('undefined');
});

test('named allowances always require a reason and removal restores enforcement', async () => {
    await using directory = await testdir();
    const policy = `level = "all"\nconfigurations = ["bash", "naming"]\n[agent_rules]\nenabled = false\n`;
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'helper_command=example\n' });
    const entry = '{"helper_command":""}';
    const allowed = await runGspot(directory.path, ['set', 'naming.allowed', entry]);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(2);
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    const explained = await runGspot(directory.path, [
        'set',
        'naming.allowed',
        '{"helper_command":"External protocol fixes this name"}',
    ]);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const checked = await runGspot(directory.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const removed = await runGspot(directory.path, ['set', 'naming.allowed', '{}']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await checkReport(directory.path, command);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    const report = restored.report;
    expect(report.checks[0]?.findings).toStrictEqual([containing({ file: 'entry.sh', line: 1, rule: 'banned-term' })]);
});

test.each([
    { key: 'naming.banned', flag: '', item: 'added', expected: ['original', 'added'] },
    { key: 'naming.banned', flag: '--remove', item: 'original', expected: undefined },
    { key: 'naming.banned', flag: '--replace', item: 'added', expected: ['added'] },
    { key: 'links.allowed_urls', flag: '', item: 'added', expected: ['original', 'added'] },
    { key: 'links.allowed_urls', flag: '--remove', item: 'original', expected: undefined },
    { key: 'links.allowed_urls', flag: '--replace', item: 'added', expected: ['added'] },
])('list edits preserve authored reasons and omit defaults for $key $flag', async ({ key, flag, item, expected }) => {
    await using directory = await testdir();
    const policy = [
        'configurations = ["bash", "naming", "docs"]',
        '[agent_rules]',
        'enabled = false',
        '[naming]',
        'banned = ["original"]',
        '[links]',
        'allowed_urls = ["original"]',
        '[reasons]',
        '"links.allowed_urls" = "The original script owns process management."',
    ].join('\n');
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const args = ['set', key, item, ...[flag].filter((value) => value !== '')];
    const result = await runGspot(directory.path, args);
    expect(result.code, result.stdout + result.stderr).toBe(0);

    const parsed = Bun.TOML.parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'));
    expect(valueAt(parsed, key.split('.'))).toStrictEqual(expected);
    if (key === 'links.allowed_urls' && expected !== undefined)
        expect(valueAt(parsed, ['reasons', key])).toBe('The original script owns process management.');
});
