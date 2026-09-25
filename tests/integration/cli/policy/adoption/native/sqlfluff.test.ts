import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { PRETTIER_TOOLING } from '#tests/support/cli/tooling.ts';
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test.each(['setup.cfg', 'tox.ini'])(
    'SQLFluff adoption carries only its section and preserves shared %s',
    async (path) => {
        await using sandbox = await testdir();
        for (const unrelated of ['', '[flake8]\nignore = E501\n']) {
            const original = `${unrelated}[sqlfluff]\nexclude_rules = LT01, RF01\n`;
            await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
            const repository = await readRepository(sandbox.path, [], [], []);
            const discovered = existingTooling(sandbox.path, repository.files, []);
            const carried = await collectCarried(sandbox.path, discovered, new Set(['sql']), ['query.sql']);
            expect(carried.unread).toStrictEqual([]);
            expect(carried.removed).toStrictEqual([]);
            expect(
                [...carried.tools.values()].flatMap((tool) => tool.ignores).map(({ check, rule }) => ({ check, rule })),
            ).toStrictEqual([
                { check: 'sql/sqlfluff', rule: 'LT01' },
                { check: 'sql/sqlfluff', rule: 'RF01' },
            ]);
            expect(carried.retained).toStrictEqual([
                { path, note: expect.stringContaining('remove that section manually') },
            ]);
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        }
        await Bun.write(join(sandbox.path, path), '[flake8]\nignore = E501\n');
        const repository = await readRepository(sandbox.path, [], [], []);
        expect(existingTooling(sandbox.path, repository.files, []).configs).toStrictEqual([]);
    },
);

test('nested SQLFluff exclusions stay inside their configuration directory', async () => {
    await using sandbox = await testdir();
    const path = 'database/.sqlfluff';
    await createFileTree(sandbox.path, { [path]: '[sqlfluff]\n; Repository exception\nexclude_rules = LT01\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const carried = await collectCarried(
        sandbox.path,
        existingTooling(sandbox.path, repository.files, []),
        new Set(['sql']),
        ['database/query.sql', 'other/query.sql'],
    );
    expect(carried.unread).toStrictEqual([]);
    expect([...carried.tools.values()].flatMap((tool) => tool.ignores)).toStrictEqual([
        { check: 'sql/sqlfluff', rule: 'LT01', paths: ['database/**'], reason: expect.any(String) },
    ]);
    expect(carried.removed.map((entry) => entry.path)).toStrictEqual([path]);
});

test.each(['.sqlfluff', 'setup.cfg'])(
    'SQLFluff adopts continued exclusions from %s and retains duplicate-key input',
    async (path) => {
        await using sandbox = await testdir();
        const prefix = path === 'setup.cfg' ? '[flake8]\r\nignore = E501\r\n' : '';
        const original = `${prefix}[sqlfluff]\r\nexclude_rules = LT01,\r\n    RF01\r\n`;
        await createFileTree(sandbox.path, { [path]: original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const detected = existingTooling(sandbox.path, repository.files, []);
        const adopted = await collectCarried(sandbox.path, detected, new Set(['sql']), []);
        expect(adopted.unread).toStrictEqual([]);
        expect(adopted.tools.get('sqlfluff')!.ignores.map((entry) => entry.rule)).toStrictEqual(['LT01', 'RF01']);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        const invalid = `${prefix}[sqlfluff]\nexclude_rules = LT01\nexclude_rules = RF01\n`;
        await Bun.write(join(sandbox.path, path), invalid);
        const refused = await collectCarried(sandbox.path, detected, new Set(['sql']), []);
        expect(refused.unread).toMatchObject([{ path, note: expect.stringContaining('Duplicate SQLFluff option') }]);
        expect(refused.removed).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(invalid);
    },
);

test.each([
    '[sqlfluff]\nexclude_rules = LT01\n[sqlfluff:rules]\ncapitalisation_policy = lower\n',
    '[sqlfluff]\nexclude_rules = LT01\n[sqlfluff]\nexclude_rules = RF01\n',
])('unsupported or duplicate shared SQLFluff sections remain unadopted', async (original) => {
    await using sandbox = await testdir();
    const path = 'setup.cfg';
    await createFileTree(sandbox.path, { [path]: original });
    const configs = [
        { tool: 'sqlfluff', check: 'sql/sqlfluff', path, table: 'sqlfluff', shared: true, carries: 'rules-table' },
    ] as const;
    const carried = await collectCarried(
        sandbox.path,
        { ...PRETTIER_TOOLING, configs: [...configs] },
        new Set(['sql']),
        [],
    );
    expect(carried.unread.map((entry) => entry.path)).toStrictEqual([path]);
    expect([...carried.tools.values()].flatMap((tool) => tool.ignores)).toStrictEqual([]);
    expect(carried.removed).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    await Bun.write(join(sandbox.path, path), '[sqlfluff]\nexclude_rules = LT01\n');
    const corrected = await collectCarried(
        sandbox.path,
        { ...PRETTIER_TOOLING, configs: [...configs] },
        new Set(['sql']),
        [],
    );
    expect(corrected.unread).toStrictEqual([]);
    expect([...corrected.tools.values()].flatMap((tool) => tool.ignores).map((entry) => entry.rule)).toStrictEqual([
        'LT01',
    ]);
    expect(corrected.removed).toStrictEqual([]);
});
