import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { collectKept } from '#cli/policy/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';

test.each(['typos.toml', 'nested/typos.toml'])(
    'invalid spelling locale in %s refuses adoption before retirement',
    async (path) => {
        await using sandbox = await testdir();
        const original = '[default]\nlocale = "en_US"\n';
        await createFileTree(sandbox.path, { [path]: original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const detected = existingTooling(sandbox.path, repository.files, []);
        const refused = await collectKept(sandbox.path, detected, new Set(['spelling']), []);
        expect(refused.unread).toMatchObject([{ path }]);
        expect(refused.removed).toStrictEqual([]);
        expect(refused.tools.size).toBe(0);
        expect(refused.scopes.size).toBe(0);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        await Bun.write(join(sandbox.path, path), '[default]\nlocale = "en-ca"\n');
        const corrected = await collectKept(sandbox.path, detected, new Set(['spelling']), []);
        expect(corrected.unread).toStrictEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toStrictEqual([path]);
    },
);

test('overlapping spelling configurations remain intact without partial adoption', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'typos.toml': '[default.extend-words]\nteh = "teh"\n',
        'nested/typos.toml': '[default]\nlocale = "en-gb"\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const kept = await collectKept(
        sandbox.path,
        existingTooling(sandbox.path, repository.files, []),
        new Set(['spelling']),
        [],
    );
    expect(kept.unread.map(({ path }) => path)).toStrictEqual(['typos.toml']);
    expect(kept.tools.size).toBe(0);
    expect(kept.scopes.size).toBe(0);
    expect(kept.removed).toStrictEqual([]);
});
