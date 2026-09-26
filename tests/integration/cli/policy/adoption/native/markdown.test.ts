import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { symlinkSync, unlinkSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { PRETTIER_TOOLING } from '#tests/support/cli/tooling.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';

test('overlapping Markdown sources remain intact before any policy is carried', async () => {
    await using sandbox = await testdir();
    const original = '{"MD033":false}\n';
    await createFileTree(sandbox.path, { '.markdownlint.jsonc': original, 'guide/.markdownlint.jsonc': original });
    const discovered = existingTooling(sandbox.path, (await readRepository(sandbox.path, [], [], [])).files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set(['markdown']), []);
    expect(carried.unread).toContainEqual(
        containing({ path: '.markdownlint.jsonc', note: textContaining('Overlapping') }),
    );
    expect(carried.removed).toStrictEqual([]);
    expect(carried.scopes.size).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.markdownlint.jsonc')).text()).toBe(original);
    expect(await Bun.file(join(sandbox.path, 'guide/.markdownlint.jsonc')).text()).toBe(original);
});

test.each(['cycle', 'escape', 'external link', 'unsupported parent'])(
    'Markdown inheritance preserves inputs for %s and accepts a corrected parent',
    async (defect) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        const original = '{"config":{"extends":"./config/base.jsonc","MD033":true}}\n';
        const validParent = '{"default":false,"MD009":true}\n';
        await createFileTree(sandbox.path, {
            '.markdownlint-cli2.jsonc': original,
            'config/base.jsonc':
                defect === 'cycle'
                    ? '{"extends":"./base.jsonc"}\n'
                    : defect === 'escape'
                      ? '{"extends":"../../outside.json"}\n'
                      : '{"customRules":["./custom.mjs"]}\n',
        });
        if (defect === 'external link') {
            await createFileTree(outside.path, { 'base.jsonc': validParent });
            unlinkSync(join(sandbox.path, 'config/base.jsonc'));
            symlinkSync(join(outside.path, 'base.jsonc'), join(sandbox.path, 'config/base.jsonc'));
        }
        const discover = {
            ...PRETTIER_TOOLING,
            configs: [{ tool: 'markdownlint-cli2', path: '.markdownlint-cli2.jsonc', carries: 'rules-table' as const }],
        };
        const refused = await collectCarried(sandbox.path, discover, new Set(['markdown']), []);
        expect(refused.unread.map(({ path }) => path)).toStrictEqual(['.markdownlint-cli2.jsonc']);
        expect(refused.removed).toStrictEqual([]);
        expect(refused.tools.get('markdownlint')?.settings['rules']).toBeUndefined();
        expect(await Bun.file(join(sandbox.path, '.markdownlint-cli2.jsonc')).text()).toBe(original);
        // A parent linked from outside the repository is never written.
        expect(
            defect !== 'external link' || (await Bun.file(join(outside.path, 'base.jsonc')).text()) === validParent,
        ).toBe(true);
        if (defect === 'external link') unlinkSync(join(sandbox.path, 'config/base.jsonc'));
        await Bun.write(join(sandbox.path, 'config/base.jsonc'), validParent);
        const corrected = await collectCarried(sandbox.path, discover, new Set(['markdown']), []);
        expect(corrected.unread).toStrictEqual([]);
        expect(corrected.tools.get('markdownlint')?.settings['rules']).toStrictEqual({
            default: false,
            MD009: true,
            MD033: true,
        });
        expect(corrected.observed.get('config/base.jsonc')?.bytes.toString()).toBe(validParent);
    },
);

test.each([
    ['.markdownlint.jsonc', '{"MD013":false,"MD033":true,"MD007":{"indent":4}}'],
    ['.markdownlint-cli2.jsonc', '{"config":{"MD013":false,"MD033":true,"MD007":{"indent":4}}}'],
])('Markdown rule choices and options survive conversion from %s', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: text });
    const carried = await collectCarried(
        sandbox.path,
        { ...PRETTIER_TOOLING, configs: [{ tool: 'markdownlint-cli2', path, carries: 'rules-table' as const }] },
        new Set(['markdown']),
        ['README.md'],
    );
    expect(carried.unread).toStrictEqual([]);
    expect(carried.tools.get('markdownlint')?.settings['rules']).toStrictEqual({
        default: true,
        MD013: false,
        MD033: true,
        MD007: { indent: 4 },
    });
    expect(carried.removed.map((entry) => entry.path)).toStrictEqual([path]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(text);
});

test.each([
    ['.markdownlint.jsonc', '{"extends":"./other.json","MD033":true}'],
    ['docs/.markdownlint.jsonc', '{"extends":"./other.json","MD033":true}'],
    ['.markdownlint-cli2.jsonc', '{"config":{"MD033":true},"customRules":["./rules.cjs"]}'],
    ['.markdownlint.jsonc', '{"MD007":{"indent":null}}'],
])('unrepresented Markdown configuration in %s remains active', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: text });
    const carried = await collectCarried(
        sandbox.path,
        { ...PRETTIER_TOOLING, configs: [{ tool: 'markdownlint-cli2', path, carries: 'rules-table' as const }] },
        new Set(['markdown']),
        ['README.md'],
    );
    expect(carried.unread.map((entry) => entry.path)).toStrictEqual([path]);
    expect(carried.removed).toStrictEqual([]);
    expect(carried.tools.get('markdownlint')?.settings['rules']).toBeUndefined();
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(text);
});
