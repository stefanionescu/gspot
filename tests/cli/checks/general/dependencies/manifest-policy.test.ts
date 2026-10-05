import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { manifests } from '#cli/checks/general/dependencies/manifests.ts';
import { MANIFEST } from '#tests/config/cli/checks/general/dependencies/manifest-policy.ts';

const DEPENDENCIES_POLICY = buildPolicy(['dependencies']);

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'dependencies/manifests')!;
    return buildEngineInput(session, spec.name, { scope: selected.scope.path });
}

describe('manifest policy reads', () => {
    test.each(['{', '{"dependencies":{"example":5}}'])(
        'reports malformed manifest %s with its path',
        async (content) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'gspot.toml': DEPENDENCIES_POLICY, 'package.json': MANIFEST });
            const inspected = await input(sandbox.path);
            fs.writeFileSync(join(sandbox.path, 'package.json'), content);
            expect(() => manifests(inspected)).toThrow('Cannot read package manifest package.json');
            fs.writeFileSync(join(sandbox.path, 'package.json'), MANIFEST);
            expect(manifests(await input(sandbox.path))).toStrictEqual([]);
        },
    );

    test('accepts an absent optional manifest and a valid manifest', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': DEPENDENCIES_POLICY, 'README.md': '# Example\n' });
        expect(manifests(await input(sandbox.path))).toStrictEqual([]);
        fs.writeFileSync(join(sandbox.path, 'package.json'), MANIFEST);
        expect(manifests(await input(sandbox.path))).toStrictEqual([]);
    });
});
