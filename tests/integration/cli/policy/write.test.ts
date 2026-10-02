import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { writePolicy, commitPolicy, preparePolicy } from '#cli/commands/edit.ts';
import { statSync, chmodSync, existsSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

import {
    setKey,
    deleteKey,
    appendList,
    scopeHolder,
    appendIgnore,
    proposePolicy,
    removeEntries,
} from '#cli/policy/mutations.ts';

const text =
    '#:schema x\n\n# Comment on kits.\nkits = ["bash"]\n\n[hooks]\n# gspot checks the changed paths of a push.\npush = "changed"\n';

test('writePolicy > policy edits retain invalid UTF-8 bytes and refuse a mode change after read', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    const invalid = Buffer.concat([Buffer.from(text), Buffer.from([0xff])]);
    writeFileSync(path, invalid);
    expect(() => writePolicy(sandbox.path, preparePolicy(sandbox.path, setKey('level', 'all')))).toThrow('valid UTF-8');
    expect(readFileSync(path)).toStrictEqual(invalid);
    writeFileSync(path, text);
    chmodSync(path, 0o644);
    expect(() =>
        writePolicy(
            sandbox.path,
            preparePolicy(sandbox.path, (raw) => {
                setKey('level', 'all')(raw);
                chmodSync(path, 0o444);
            }),
        ),
    ).toThrow('changed while the edit was prepared');
    expect(readFileSync(path, 'utf8')).toBe(text);
    expect(statSync(path).mode & 0o222).toBe(0);
    chmodSync(path, 0o644);
});

test.each([true, false])(
    'writePolicy > policy edits reject an external symlink before evaluating a mutation (dry run: %s)',
    async (isDryRun) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'project/.keep': '', 'outside.toml': text });
        const root = join(sandbox.path, 'project');
        symlinkSync('../outside.toml', join(root, 'gspot.toml'));
        let evaluated = false;
        expect(() =>
            isDryRun
                ? preparePolicy(root, () => {
                      evaluated = true;
                  })
                : writePolicy(
                      root,
                      preparePolicy(root, () => {
                          evaluated = true;
                      }),
                  ),
        ).toThrow('private regular file');
        expect(evaluated).toBe(false);
        expect(readFileSync(join(sandbox.path, 'outside.toml'), 'utf8')).toBe(text);
        expect(existsSync(join(root, '.gspot'))).toBe(false);
    },
);

test('writePolicy > appends an ignore entry and keeps comments and order', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': text });
    const result = writePolicy(
        sandbox.path,
        preparePolicy(
            sandbox.path,
            appendIgnore({
                check: 'bash/shellcheck',
                rule: 'SC2312',
                reason: 'set -e interaction on every correct if-function.',
            }),
        ),
    );
    const written = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(written).toContain('# Comment on kits.');
    expect(written).toContain('# gspot checks the changed paths of a push.');
    expect(written).toContain('[[ignore]]');
    expect(result.policy.ignores[0]?.rule).toBe('SC2312');
    expect(written.indexOf('[hooks]')).toBeLessThan(written.indexOf('[[ignore]]'));
});

test('writePolicy > sets a nested key, then deletes it and the empty table', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': text });
    writePolicy(sandbox.path, preparePolicy(sandbox.path, setKey('limits.bash.file_lines', 100)));
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain('[limits.bash]');
    writePolicy(sandbox.path, preparePolicy(sandbox.path, deleteKey('limits.bash.file_lines')));
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('file_lines');
});

test('policy edits keep a trailing array comma and write inline tables without one', () => {
    const original = '# Authored selection.\nkits = ["security",]\n';
    const entry = {
        rule: 'js/file-system-race',
        paths: ['fixture.js'],
        reason: 'A deliberate fixture owns its temporary files.',
    };
    const mutate = setKey('tools.codeql.false_positives', [entry]);
    const proposed = proposePolicy('.', original, mutate);
    expect(proposed.text).toContain('# Authored selection.');
    expect(proposed.text).not.toMatch(/,\s*\}/u);
    expect(proposed.policy.tools['codeql']?.['false_positives']).toStrictEqual([entry]);
    const repeated = proposePolicy('.', proposed.text, mutate);
    expect(repeated.changed).toBe(false);
    expect(repeated.text).toBe(proposed.text);
});

test('writePolicy > appends to a list without duplicates and removes matching entries', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': text });
    writePolicy(
        sandbox.path,
        preparePolicy(sandbox.path, appendList('naming.banned_terms', ['dispatcher', 'orchestrator'])),
    );
    writePolicy(sandbox.path, preparePolicy(sandbox.path, appendList('naming.banned_terms', ['dispatcher'])));
    const written = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(written.match(/dispatcher/g)).toHaveLength(1);
    const counter = { removed: 0 };
    writePolicy(
        sandbox.path,
        preparePolicy(sandbox.path, appendIgnore({ check: 'bash/shellcheck', reason: 'A sentence that says why.' })),
    );
    writePolicy(
        sandbox.path,
        preparePolicy(
            sandbox.path,
            removeEntries('ignore', (entry) => entry['check'] === 'bash/shellcheck', counter),
        ),
    );
    expect(counter.removed).toBe(1);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('[[ignore]]');
});

test('writePolicy > an ignore joins the entry with the same check, rule, and reason, and a new reason adds an entry', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': text });
    const reason = 'Generated fixtures repeat on purpose.';
    writePolicy(
        sandbox.path,
        preparePolicy(
            sandbox.path,
            appendIgnore({ check: 'bash/shellcheck', rule: 'SC2312', paths: ['fixtures/a.sh'], reason }),
        ),
    );
    writePolicy(
        sandbox.path,
        preparePolicy(
            sandbox.path,
            appendIgnore({
                check: 'bash/shellcheck',
                rule: 'SC2312',
                paths: ['fixtures/b.sh', 'fixtures/a.sh'],
                reason,
            }),
        ),
    );
    const merged = preparePolicy(
        sandbox.path,
        appendIgnore({ check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' }),
    );
    writePolicy(sandbox.path, merged);
    expect(merged.policy.ignores).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['fixtures/a.sh', 'fixtures/b.sh'], reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8').match(/\[\[ignore\]\]/g)).toHaveLength(2);
    const everywhere = preparePolicy(sandbox.path, appendIgnore({ check: 'bash/shellcheck', rule: 'SC2312', reason }));
    expect(everywhere.policy.ignores[0]).toStrictEqual({ check: 'bash/shellcheck', rule: 'SC2312', reason });
});

test.each([
    ['a sub-table', '[[scope]]\npath = "api"\n[scope.limits]\nfile_lines = 100\n'],
    ['an inline table', '[[scope]]\npath = "api"\nlimits = { file_lines = 100 }\n'],
])('writePolicy > a scope setting written into %s loads with the ones already there', async (_form, scope) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': `${text}\n${scope}`, 'api/run.sh': '' });
    const result = preparePolicy(sandbox.path, (raw) => {
        setKey('limits.function_lines', 20)(scopeHolder(raw, 'api'));
    });
    writePolicy(sandbox.path, result);
    expect(result.policy.scopeTables['api']?.limits?.root).toStrictEqual({
        file_lines: { value: 100 },
        function_lines: { value: 20 },
    });
    expect(preparePolicy(sandbox.path, () => {}).policy.scopeTables['api']?.limits?.root).toMatchObject({
        function_lines: { value: 20 },
    });
});

test('writePolicy > a dry run writes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': text });
    const result = preparePolicy(sandbox.path, setKey('level', 'all'));
    expect(result.changed).toBe(true);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(text);
});

test('writePolicy > a refused reason is caught before the file is written', async () => {
    await using sandbox = await testdir();
    const required = text.replace('kits = ["bash"]', 'require_reasons = true\nkits = ["bash"]');
    await createFileTree(sandbox.path, { 'gspot.toml': required });
    expect(() =>
        writePolicy(
            sandbox.path,
            preparePolicy(sandbox.path, appendIgnore({ check: 'bash/shellcheck', reason: 'TBD' })),
        ),
    ).toThrow('needs a reason that says something');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(required);
});

test('a prepared policy edit refuses stale bytes and accepts a fresh plan', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    writeFileSync(path, text);
    const plan = preparePolicy(sandbox.path, setKey('level', 'all'));
    writeFileSync(path, `${text}\n# Concurrent edit.\n`);
    expect(() => writePolicy(sandbox.path, plan)).toThrow('changed while the edit was prepared');
    expect(readFileSync(path, 'utf8')).toBe(`${text}\n# Concurrent edit.\n`);
    const corrected = preparePolicy(sandbox.path, setKey('level', 'all'));
    expect(writePolicy(sandbox.path, corrected).policy.level).toBe('all');
    expect(readFileSync(path, 'utf8')).toBe(corrected.text);
});

test('a policy command evaluates its mutation once before applying the prepared result', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    writeFileSync(path, policyOf([], '[guides]\ninstall = false\n'));
    let evaluations = 0;
    const result = await commitPolicy(
        sandbox.path,
        (raw) => {
            evaluations += 1;
            setKey('require_reasons', evaluations === 1)(raw);
        },
        false,
        'Updated require_reasons.',
    );
    expect(result.exitCode).toBe(0);
    expect(evaluations).toBe(1);
    expect(readFileSync(path, 'utf8')).toContain('require_reasons = true');
});
