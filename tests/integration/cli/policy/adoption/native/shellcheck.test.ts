import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';

test('disabled-rule adoption carries the declared destination and refuses an undeclared destination', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.shellcheckrc': 'disable=SC2086\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const detected = existingTooling(sandbox.path, repository.files, []);
    const declared = detected.configs.find((entry) => entry.tool === 'shellcheck')!;
    declared.check = 'shell-policy/lint';
    const adopted = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(adopted.unread).toStrictEqual([]);
    expect(adopted.tools.get('shellcheck')!.ignores).toMatchObject([{ check: declared.check, rule: 'SC2086' }]);
    delete declared.check;
    const refused = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(refused.unread).toMatchObject([{ path: '.shellcheckrc' }]);
    expect(refused.removed).toStrictEqual([]);
    expect(refused.tools.has('shellcheck')).toBe(false);
});

test('ShellCheck adoption separates comments and quotes from every disabled code', async () => {
    await using sandbox = await testdir();
    const original = 'disable="2086" # preserve word splitting\ndisable=SC2002\n';
    await createFileTree(sandbox.path, { '.shellcheckrc': original });
    const repository = await readRepository(sandbox.path, [], [], []);
    const detected = existingTooling(sandbox.path, repository.files, []);
    const carried = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(carried.unread).toStrictEqual([]);
    expect(carried.tools.get('shellcheck')!.ignores.map((entry) => entry.rule)).toStrictEqual(['SC2086', 'SC2002']);
    expect(await Bun.file(join(sandbox.path, '.shellcheckrc')).text()).toBe(original);
});
