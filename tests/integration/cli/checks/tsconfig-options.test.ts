import { engineInput } from '#cli/run/engines.ts';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { expect, spyOn, test } from 'bun:test';
import type { EngineInput } from '#cli/run/types.ts';
import { openSession } from '#cli/run/session.ts';
import { tsconfigOptions } from '#cli/checks/typescript/tsconfig-options.ts';

const POLICY = 'version = 1\npresets = ["typescript"]\n';

async function inputFor(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selection = session.scopes[0]!;
    const spec = selection.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'integrity/tsconfig-options')!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
}

test.each(['{', 'null', '[]', '{"extends":7}', '{"compilerOptions":[]}'])(
    'malformed TypeScript configuration %s reports its path instead of missing options',
    async (content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': POLICY, 'tsconfig.json': content });
        const input = await inputFor(sandbox.path);
        expect(() => tsconfigOptions(input)).toThrow(
            `Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}`,
        );
    },
);

test('a denied TypeScript configuration read retains its error', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POLICY, 'tsconfig.json': '{}' });
    const input = await inputFor(sandbox.path);
    const denied = spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    });
    try {
        expect(() => tsconfigOptions(input)).toThrow('Permission denied');
    } finally {
        denied.mockRestore();
    }
});

test('a missing inherited configuration cannot be replaced by empty compiler options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'tsconfig.json': '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
    });
    const input = await inputFor(sandbox.path);
    expect(() => tsconfigOptions(input)).toThrow(`Cannot read file '${join(sandbox.path, 'missing.json')}'`);
});

test('circular configuration inheritance reports the cycle', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'tsconfig.json': '{"extends":"./base.json"}',
        'base.json': '{"extends":"./tsconfig.json"}',
    });
    const input = await inputFor(sandbox.path);
    expect(() => tsconfigOptions(input)).toThrow('Circularity detected while resolving configuration');
});

test.each([
    ['left', 'right'],
    ['right', 'left'],
])('inheritance through %s then %s applies the later branch last', async (first, second) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'tsconfig.json': JSON.stringify({ extends: [`./${first}.json`, `./${second}.json`] }),
        'left.json': '{"extends":"./base.json","compilerOptions":{"strict":false}}',
        'right.json': '{"extends":"./base.json"}',
        'base.json': '{ // Shared options.\n"compilerOptions":{"strict":true,},}',
    });
    const findings = await tsconfigOptions(await inputFor(sandbox.path));
    expect(findings.some((finding) => finding.rule === 'strict')).toBe(second === 'left');
});

test('a scope without tsconfig.json reports the missing configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POLICY });
    const findings = await tsconfigOptions(await inputFor(sandbox.path));
    expect(findings).toMatchObject([{ file: 'tsconfig.json', message: expect.stringContaining('no tsconfig.json') }]);
});

test.each(['tsconfig.json', 'strict.json'])(
    'nested configurations inherit an ancestor package through %s',
    async (filename) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': POLICY,
            'tsconfig.json': '{"extends":"./apps/web/tsconfig.json"}',
            'apps/web/tsconfig.json': '{"extends":"@example/config"}',
            'node_modules/@example/config/package.json': JSON.stringify({
                name: '@example/config',
                tsconfig: filename,
            }),
            [`node_modules/@example/config/${filename}`]: '{"compilerOptions":{"strict":true}}',
        });
        const input = await inputFor(sandbox.path);
        const inherited = await tsconfigOptions(input);
        expect(inherited.filter((finding) => finding.rule === 'strict')).toEqual([]);
        fs.writeFileSync(
            join(sandbox.path, 'apps/web/tsconfig.json'),
            '{"extends":"@example/config","compilerOptions":{"strict":false}}',
        );
        const overridden = await tsconfigOptions(input);
        expect(
            overridden
                .filter((finding) => finding.rule === 'strict')
                .map(({ check, file, rule }) => ({ check, file, rule })),
        ).toEqual([
            { check: 'integrity/tsconfig-options', file: 'tsconfig.json', rule: 'strict' },
            { check: 'integrity/tsconfig-options', file: 'apps/web/tsconfig.json', rule: 'strict' },
        ]);
    },
);
