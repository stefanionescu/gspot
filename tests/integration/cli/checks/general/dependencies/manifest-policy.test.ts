import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import { manifestPolicy } from '#cli/checks/general/dependencies/manifests.ts';

const DEPENDENCIES_POLICY = policyOf(['dependencies']);

const MANIFEST = '{"private":true,"packageManager":"bun@1.3.11"}\n';

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'integrity/manifest-policy')!;
    return scopeInput(session, spec, selected.scope.path);
}

describe('manifest policy reads', () => {
    test.each(['{', '{"dependencies":{"example":5}}'])(
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

    test('accepts an absent optional manifest and a valid manifest', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': DEPENDENCIES_POLICY, 'README.md': '# Example\n' });
        expect(manifestPolicy(await input(sandbox.path))).toStrictEqual([]);
        fs.writeFileSync(join(sandbox.path, 'package.json'), MANIFEST);
        expect(manifestPolicy(await input(sandbox.path))).toStrictEqual([]);
    });
});
