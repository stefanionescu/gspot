import * as fs from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import type { EngineInput } from '#cli/types/checks/checks.ts';
import { manifestPolicy } from '#cli/checks/dependencies/manifest-policy.ts';
import { DEPENDENCIES_POLICY, MANIFEST } from '#tests/constants/integration/cli/checks.ts';

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'integrity/manifest-policy')!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === selected.scope.path)!,
        spec: spec,
        files: session.repository.files,
    });
}

describe('manifest policy observations', () => {
    test.each(['{', '[]', 'null', '{"dependencies":{"example":5}}', '{"packageManager":false}'])(
        'reports malformed manifest %s with its path',
        async (content) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'gspot.toml': DEPENDENCIES_POLICY, 'package.json': MANIFEST });
            const inspected = await input(sandbox.path);
            fs.writeFileSync(join(sandbox.path, 'package.json'), content);
            expect(() => manifestPolicy(inspected)).toThrow('Cannot read package manifest package.json');
            fs.writeFileSync(join(sandbox.path, 'package.json'), MANIFEST);
            expect(manifestPolicy(await input(sandbox.path))).toStrictEqual([]);
        },
    );

    test('reports a denied read without discarding the manifest', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': DEPENDENCIES_POLICY, 'package.json': MANIFEST });
        const inspected = await input(sandbox.path);
        const denied = spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw Object.assign(new Error('Permission denied'), { code: 'EACCES' });
        });
        try {
            expect(() => manifestPolicy(inspected)).toThrow('package.json: Permission denied');
        } finally {
            denied.mockRestore();
        }
        expect(manifestPolicy(await input(sandbox.path))).toStrictEqual([]);
    });

    test('accepts an absent optional manifest and a valid manifest', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': DEPENDENCIES_POLICY, 'README.md': '# Example\n' });
        expect(manifestPolicy(await input(sandbox.path))).toStrictEqual([]);
        fs.writeFileSync(join(sandbox.path, 'package.json'), MANIFEST);
        expect(manifestPolicy(await input(sandbox.path))).toStrictEqual([]);
    });
});
