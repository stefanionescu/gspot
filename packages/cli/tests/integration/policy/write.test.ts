import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { appendEntry, appendList, deleteKey, removeEntries, setKey, writePolicy } from '#cli/policy/write.ts';

const text =
    '#:schema x\n\n# Comment on version.\nversion = 1\npresets = ["bash"]\n\n[hooks]\n# gspot writes the hooks.\ntool = "gspot"\n';

describe('writePolicy', () => {
    test('appends an ignore entry and keeps comments and order', async () => {
        await using sandbox = await createSandbox({ 'gspot.toml': text });
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
        await using sandbox = await createSandbox({ 'gspot.toml': text });
        writePolicy(sandbox.path, setKey('limits.bash.file_lines', 100));
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain('[limits.bash]');
        writePolicy(sandbox.path, deleteKey('limits.bash.file_lines'));
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('file_lines');
    });

    test('appends to a list without duplicates and removes matching entries', async () => {
        await using sandbox = await createSandbox({ 'gspot.toml': text });
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
        await using sandbox = await createSandbox({ 'gspot.toml': text });
        const result = writePolicy(sandbox.path, setKey('coverage.strict', true), true);
        expect(result.changed).toBe(true);
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(text);
    });

    test('a refused reason is caught before the file is written', async () => {
        await using sandbox = await createSandbox({ 'gspot.toml': text });
        expect(() =>
            writePolicy(sandbox.path, appendEntry('ignore', { check: 'bash/shellcheck', reason: 'TBD' })),
        ).toThrow('needs a reason that says something');
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(text);
    });
});
