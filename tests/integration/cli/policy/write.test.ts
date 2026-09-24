import { commitPolicy } from '#cli/commands/policy.ts';
import { preparePolicy, writePolicy } from '#cli/lifecycle/policy.ts';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { chmodSync, existsSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { appendEntry, appendList, deleteKey, removeEntries, setKey } from '#cli/policy/write.ts';

const text =
    '#:schema x\n\n# Comment on version.\nversion = 1\nconfigurations = ["bash"]\n\n[hooks]\n# gspot writes the hooks.\ntool = "gspot"\n';

describe('writePolicy', () => {
    test('policy edits retain invalid UTF-8 bytes and refuse a mode change after observation', async () => {
        await using sandbox = await testdir();
        const path = join(sandbox.path, 'gspot.toml');
        const invalid = Buffer.concat([Buffer.from(text), Buffer.from([0xff])]);
        writeFileSync(path, invalid);
        expect(() => writePolicy(sandbox.path, preparePolicy(sandbox.path, setKey('coverage.strict', true)))).toThrow(
            'valid UTF-8',
        );
        expect(readFileSync(path)).toStrictEqual(invalid);
        writeFileSync(path, text);
        chmodSync(path, 0o644);
        expect(() =>
            writePolicy(
                sandbox.path,
                preparePolicy(sandbox.path, (raw) => {
                    setKey('coverage.strict', true)(raw);
                    chmodSync(path, 0o444);
                }),
            ),
        ).toThrow('changed while the edit was prepared');
        expect(readFileSync(path, 'utf8')).toBe(text);
        expect(statSync(path).mode & 0o222).toBe(0);
        chmodSync(path, 0o644);
    });

    test.each([true, false])(
        'policy edits reject an external symlink before evaluating a mutation (dry run: %s)',
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

    test('appends an ignore entry and keeps comments and order', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': text });
        const result = writePolicy(
            sandbox.path,
            preparePolicy(
                sandbox.path,
                appendEntry('ignore', {
                    check: 'bash/shellcheck',
                    rule: 'SC2312',
                    reason: 'set -e interaction on every correct if-function.',
                }),
            ),
        );
        const written = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
        expect(written).toContain('# Comment on version.');
        expect(written).toContain('# gspot writes the hooks.');
        expect(written).toContain('[[ignore]]');
        expect(result.policy.ignores[0]?.rule).toBe('SC2312');
        expect(written.indexOf('[hooks]')).toBeLessThan(written.indexOf('[[ignore]]'));
    });

    test('sets a nested key, then deletes it and the empty table', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': text });
        writePolicy(sandbox.path, preparePolicy(sandbox.path, setKey('limits.bash.file_lines', 100)));
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain('[limits.bash]');
        writePolicy(sandbox.path, preparePolicy(sandbox.path, deleteKey('limits.bash.file_lines')));
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('file_lines');
    });

    test('appends to a list without duplicates and removes matching entries', async () => {
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
            preparePolicy(
                sandbox.path,
                appendEntry('ignore', { check: 'bash/shellcheck', reason: 'A sentence that says why.' }),
            ),
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

    test('a dry run writes nothing', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': text });
        const result = preparePolicy(sandbox.path, setKey('coverage.strict', true));
        expect(result.changed).toBe(true);
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(text);
    });

    test('a refused reason is caught before the file is written', async () => {
        await using sandbox = await testdir();
        const required = text.replace('version = 1', 'version = 1\nrequire_reasons = true');
        await createFileTree(sandbox.path, { 'gspot.toml': required });
        expect(() =>
            writePolicy(
                sandbox.path,
                preparePolicy(sandbox.path, appendEntry('ignore', { check: 'bash/shellcheck', reason: 'TBD' })),
            ),
        ).toThrow('needs a reason that says something');
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(required);
    });
});

test('a prepared policy edit refuses stale bytes and accepts a fresh proposal', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    writeFileSync(path, text);
    const proposal = preparePolicy(sandbox.path, setKey('coverage.strict', true));
    writeFileSync(path, `${text}\n# Concurrent edit.\n`);
    expect(() => writePolicy(sandbox.path, proposal)).toThrow('changed while the edit was prepared');
    expect(readFileSync(path, 'utf8')).toBe(`${text}\n# Concurrent edit.\n`);
    const corrected = preparePolicy(sandbox.path, setKey('coverage.strict', true));
    expect(writePolicy(sandbox.path, corrected).policy.coverage.strict).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(corrected.text);
});

test('a policy command evaluates its mutation once before applying the prepared result', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    writeFileSync(path, 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n');
    let evaluations = 0;
    const result = await commitPolicy(
        sandbox.path,
        (raw) => {
            evaluations += 1;
            setKey('coverage.strict', evaluations === 1)(raw);
        },
        false,
        'Updated coverage.',
    );
    expect(result.exitCode).toBe(0);
    expect(evaluations).toBe(1);
    expect(readFileSync(path, 'utf8')).toContain('strict = true');
});
