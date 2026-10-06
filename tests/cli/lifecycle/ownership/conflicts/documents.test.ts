import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { proposeRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { proposeBlock, proposeMerge } from '#cli/lifecycle/ownership/plans.ts';

test('TOML task ownership refuses malformed and edited fields and creates new tables', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'broken.toml': '[tasks\n' });
    {
        using log = openOwnership(directory.path);

        const changes = [{ path: ['tasks', 'gspot:check', 'run'], value: 'gspot check' }];
        expect(() => proposeMerge(log, 'broken.toml', changes, true)).toThrow();
        expect(readFileSync(join(directory.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
        applyPlan(log, proposeMerge(log, 'mise.toml', changes));
        const installed = readFileSync(join(directory.path, 'mise.toml'), 'utf8');
        expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: 'gspot check' } } });
        writeFileSync(join(directory.path, 'mise.toml'), installed.replace('gspot check', 'authored check'));
        expect(applyPlan(log, proposeRestoration(log, 'mise.toml'))).toBe('preserved');
        expect(readFileSync(join(directory.path, 'mise.toml'), 'utf8')).toContain('authored check');
    }
});

test('edited and repeated managed blocks are preserved without overwriting their contents', async () => {
    await using directory = await testdir();
    {
        using log = openOwnership(directory.path);

        applyPlan(log, proposeBlock(log, 'AGENTS.md', 'installed instructions', 'markdown'));
        const edited = log.files
            .read('AGENTS.md')!
            .bytes.toString('utf8')
            .replace('installed instructions', 'authored instructions');
        writeFileSync(join(directory.path, 'AGENTS.md'), edited);
        expect(applyPlan(log, proposeBlock(log, 'AGENTS.md', 'replacement', 'markdown'))).toBe('preserved');
        expect(applyPlan(log, proposeRestoration(log, 'AGENTS.md'))).toBe('preserved');
        expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(edited);
        writeFileSync(join(directory.path, 'AGENTS.md'), edited + edited);
        expect(() => applyPlan(log, proposeBlock(log, 'AGENTS.md', 'replacement', 'markdown'))).toThrow(
            'incomplete or repeated',
        );
        expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(edited + edited);
    }
});

test('shared TOML preserves changed managed keys and rejects malformed input', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'config.toml': 'extends = "./original.json"\n' });
    {
        using log = openOwnership(directory.path);

        applyPlan(log, proposeMerge(log, 'config.toml', [{ path: ['extends'], value: './managed.json' }], true));
        const authored = 'extends = "./authored.json"\n';
        writeFileSync(join(directory.path, 'config.toml'), authored);
        expect(applyPlan(log, proposeMerge(log, 'config.toml', [{ path: ['extends'], value: './next.json' }]))).toBe(
            'preserved',
        );
        expect(applyPlan(log, proposeRestoration(log, 'config.toml'))).toBe('preserved');
        expect(log.files.read('config.toml')!.bytes.toString('utf8')).toBe(authored);
        writeFileSync(join(directory.path, 'invalid.toml'), '[ unfinished');
        expect(() =>
            applyPlan(log, proposeMerge(log, 'invalid.toml', [{ path: ['value'], value: true }], true)),
        ).toThrow('invalid.toml is not valid TOML. Fix the file, then run gspot apply.');
        expect(log.files.read('invalid.toml')!.bytes.toString('utf8')).toBe('[ unfinished');
    }
});

test.each(['json', 'toml'])('restoration preserves an authored non-UTF-8 edit to owned %s fields', async (format) => {
    await using sandbox = await testdir();
    const path = `config.${format}`;
    await createFileTree(sandbox.path, { [path]: format === 'json' ? '{}\n' : 'authored = true\n' });
    using log = openOwnership(sandbox.path);
    applyPlan(log, proposeMerge(log, path, [{ path: ['owned'], value: true }], true));
    const authored = Buffer.from([0xff]);
    writeFileSync(join(sandbox.path, path), authored);
    const recorded = structuredClone(log.state);
    expect(applyPlan(log, proposeRestoration(log, path))).toBe('preserved');
    expect(readFileSync(join(sandbox.path, path))).toStrictEqual(authored);
    expect(log.state).toStrictEqual(recorded);
});
