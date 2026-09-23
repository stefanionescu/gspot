import { join } from 'node:path';
import { chmodSync, existsSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { appendEntry, appendList, deleteKey, removeEntries, setKey, writePolicy } from '#cli/policy/write.ts';

const text =
    '#:schema x\n\n# Comment on version.\nversion = 1\npresets = ["bash"]\n\n[hooks]\n# gspot writes the hooks.\ntool = "gspot"\n';

describe('writePolicy', () => {
    test('policy edits retain invalid UTF-8 bytes and refuse a mode change after observation', async () => {
        await using sandbox = await testdir();
        const path = join(sandbox.path, 'gspot.toml');
        const invalid = Buffer.concat([Buffer.from(text), Buffer.from([0xff])]);
        writeFileSync(path, invalid);
        expect(() => writePolicy(sandbox.path, setKey('coverage.strict', true))).toThrow('valid UTF-8');
        expect(readFileSync(path)).toEqual(invalid);
        writeFileSync(path, text);
        chmodSync(path, 0o644);
        expect(() =>
            writePolicy(sandbox.path, (raw) => {
                setKey('coverage.strict', true)(raw);
                chmodSync(path, 0o444);
            }),
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
                writePolicy(
                    root,
                    () => {
                        evaluated = true;
                    },
                    isDryRun,
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
            appendEntry('ignore', {
                check: 'bash/shellcheck',
                rule: 'SC2312',
                reason: 'set -e interaction on every correct if-function.',
            }),
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
        writePolicy(sandbox.path, setKey('limits.bash.file_lines', 100));
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain('[limits.bash]');
        writePolicy(sandbox.path, deleteKey('limits.bash.file_lines'));
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('file_lines');
    });

    test('appends to a list without duplicates and removes matching entries', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': text });
        writePolicy(sandbox.path, appendList('naming.banned_terms', ['dispatcher', 'orchestrator']));
        writePolicy(sandbox.path, appendList('naming.banned_terms', ['dispatcher']));
        const written = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
        expect(written.match(/dispatcher/g)).toHaveLength(1);
        const counter = { removed: 0 };
        writePolicy(
            sandbox.path,
            appendEntry('ignore', { check: 'bash/shellcheck', reason: 'A sentence that says why.' }),
        );
        writePolicy(
            sandbox.path,
            removeEntries('ignore', (entry) => entry['check'] === 'bash/shellcheck', counter),
        );
        expect(counter.removed).toBe(1);
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('[[ignore]]');
    });

    test('a dry run writes nothing', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': text });
        const result = writePolicy(sandbox.path, setKey('coverage.strict', true), true);
        expect(result.changed).toBe(true);
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(text);
    });

    test('a refused reason is caught before the file is written', async () => {
        await using sandbox = await testdir();
        const required = text.replace('version = 1', 'version = 1\nrequire_reasons = true');
        await createFileTree(sandbox.path, { 'gspot.toml': required });
        expect(() =>
            writePolicy(sandbox.path, appendEntry('ignore', { check: 'bash/shellcheck', reason: 'TBD' })),
        ).toThrow('needs a reason that says something');
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(required);
    });
});
