import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { openOwner } from '#cli/lifecycle/ownership/owner.ts';

test('TOML task ownership refuses malformed and edited fields and creates new tables', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'broken.toml': '[tasks\n' });
    const owner = openOwner(directory.path);
    try {
        const changes = [{ path: ['tasks', 'gspot:check', 'run'], value: 'gspot check' }];
        expect(() => owner.proposeMerge('broken.toml', 'toml', changes, true)).toThrow();
        expect(readFileSync(join(directory.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
        owner.applyPlan(owner.proposeMerge('mise.toml', 'toml', changes));
        const installed = readFileSync(join(directory.path, 'mise.toml'), 'utf8');
        expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: 'gspot check' } } });
        writeFileSync(join(directory.path, 'mise.toml'), installed.replace('gspot check', 'authored check'));
        expect(owner.applyPlan(owner.proposeRestoration('mise.toml'))).toBe('preserved');
        expect(readFileSync(join(directory.path, 'mise.toml'), 'utf8')).toContain('authored check');
    } finally {
        owner.close();
    }
});

test('edited and repeated managed blocks are preserved without overwriting their contents', async () => {
    await using directory = await testdir();
    const owner = openOwner(directory.path);
    try {
        owner.replaceBlock('AGENTS.md', 'installed instructions', 'markdown');
        const edited = owner
            .read('AGENTS.md')!
            .bytes.toString('utf8')
            .replace('installed instructions', 'authored instructions');
        writeFileSync(join(directory.path, 'AGENTS.md'), edited);
        expect(owner.replaceBlock('AGENTS.md', 'replacement', 'markdown')).toBe('preserved');
        expect(owner.applyPlan(owner.proposeRestoration('AGENTS.md'))).toBe('preserved');
        expect(owner.read('AGENTS.md')!.bytes.toString('utf8')).toBe(edited);
        writeFileSync(join(directory.path, 'AGENTS.md'), edited + edited);
        expect(() => owner.replaceBlock('AGENTS.md', 'replacement', 'markdown')).toThrow('incomplete or repeated');
        expect(owner.read('AGENTS.md')!.bytes.toString('utf8')).toBe(edited + edited);
    } finally {
        owner.close();
    }
});

test('shared JSON preserves changed managed keys and rejects malformed input', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'tsconfig.json': '{"extends":"./original.json"}\n' });
    const owner = openOwner(directory.path);
    try {
        owner.applyPlan(
            owner.proposeMerge('tsconfig.json', 'json', [{ path: ['extends'], value: './managed.json' }], true),
        );
        const authored = '{"extends":"./authored.json"}\n';
        writeFileSync(join(directory.path, 'tsconfig.json'), authored);
        expect(
            owner.applyPlan(owner.proposeMerge('tsconfig.json', 'json', [{ path: ['extends'], value: './next.json' }])),
        ).toBe('preserved');
        expect(owner.applyPlan(owner.proposeRestoration('tsconfig.json'))).toBe('preserved');
        expect(owner.read('tsconfig.json')!.bytes.toString('utf8')).toBe(authored);
        writeFileSync(join(directory.path, 'invalid.json'), '{ unfinished');
        expect(() =>
            owner.applyPlan(owner.proposeMerge('invalid.json', 'json', [{ path: ['value'], value: true }], true)),
        ).toThrow('valid JSON object');
        expect(owner.read('invalid.json')!.bytes.toString('utf8')).toBe('{ unfinished');
    } finally {
        owner.close();
    }
});
