import * as fs from 'node:fs';
import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { expect, spyOn, test } from 'bun:test';
import type { EngineInput } from '#types/run.ts';
import { openSession } from '#cli/run/session.ts';
import { tsconfigOptions } from '#cli/integrity/tsconfig-options.ts';

const POLICY = 'version = 1\npresets = ["typescript"]\n';

async function inputFor(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selection = session.scopes[0]!;
    const spec = selection.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'integrity/tsconfig-options')!;
    return { session, root, scope: '', view: selection.view, spec, files: session.repository.files };
}

test.each(['{', 'null', '[]', '{"extends":7}', '{"compilerOptions":[]}'])(
    'malformed TypeScript configuration %s reports its path instead of missing options',
    async (content) => {
        await using sandbox = await createSandbox({ 'gspot.toml': POLICY, 'tsconfig.json': content });
        const input = await inputFor(sandbox.path);
        expect(() => tsconfigOptions(input)).toThrow(
            `Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}`,
        );
    },
);

test('a denied TypeScript configuration read retains its error', async () => {
    await using sandbox = await createSandbox({ 'gspot.toml': POLICY, 'tsconfig.json': '{}' });
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
    await using sandbox = await createSandbox({
        'gspot.toml': POLICY,
        'tsconfig.json': '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
    });
    const input = await inputFor(sandbox.path);
    expect(() => tsconfigOptions(input)).toThrow('missing.json does not exist');
});

test('circular configuration inheritance reports the cycle', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': POLICY,
        'tsconfig.json': '{"extends":"./base.json"}',
        'base.json': '{"extends":"./tsconfig.json"}',
    });
    const input = await inputFor(sandbox.path);
    expect(() => tsconfigOptions(input)).toThrow('Circular TypeScript configuration inheritance');
});

test.each([
    ['left', 'right'],
    ['right', 'left'],
])('inheritance through %s then %s applies the later branch last', async (first, second) => {
    await using sandbox = await createSandbox({
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
    await using sandbox = await createSandbox({ 'gspot.toml': POLICY });
    const findings = await tsconfigOptions(await inputFor(sandbox.path));
    expect(findings).toMatchObject([{ file: 'tsconfig.json', message: expect.stringContaining('no tsconfig.json') }]);
});
