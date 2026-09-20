import * as fs from 'node:fs';
import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import type { EngineInput } from '#types/run.ts';
import { openSession } from '#cli/run/session.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { manifestPolicy } from '#cli/integrity/manifest-policy.ts';

const POLICY = 'version = 1\npresets = ["dependencies"]\n';
const MANIFEST = '{"private":true,"packageManager":"bun@1.3.11"}\n';

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'integrity/manifest-policy')!;
    return { session, root, scope: selected.scope.path, view: selected.view, spec, files: session.repository.files };
}

describe('manifest policy observations', () => {
    test.each(['{', '[]', 'null', '{"dependencies":{"example":5}}', '{"packageManager":false}'])(
        'reports malformed manifest %s with its path',
        async (content) => {
            await using sandbox = await createSandbox({ 'gspot.toml': POLICY, 'package.json': MANIFEST });
            const inspected = await input(sandbox.path);
            fs.writeFileSync(join(sandbox.path, 'package.json'), content);
            expect(() => manifestPolicy(inspected)).toThrow('Cannot read package manifest package.json');
        },
    );

    test('reports a denied read without discarding the manifest', async () => {
        await using sandbox = await createSandbox({ 'gspot.toml': POLICY, 'package.json': MANIFEST });
        const inspected = await input(sandbox.path);
        const denied = spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw Object.assign(new Error('Permission denied'), { code: 'EACCES' });
        });
        try {
            expect(() => manifestPolicy(inspected)).toThrow('package.json: Permission denied');
        } finally {
            denied.mockRestore();
        }
    });

    test('accepts an absent optional manifest and a valid manifest', async () => {
        await using sandbox = await createSandbox({ 'gspot.toml': POLICY, 'README.md': '# Example\n' });
        expect(await manifestPolicy(await input(sandbox.path))).toEqual([]);
        fs.writeFileSync(join(sandbox.path, 'package.json'), MANIFEST);
        expect(await manifestPolicy(await input(sandbox.path))).toEqual([]);
    });
});
