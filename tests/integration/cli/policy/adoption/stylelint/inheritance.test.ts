import { join } from 'node:path';
import stylelint from 'stylelint';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { rejection } from '#tests/support/rejection.ts';
import { readFileSync, rmSync, symlinkSync } from 'node:fs';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { STYLELINT_TOOLING } from '#tests/support/cli/stylelint.ts';

test('Stylelint package lookups do not adopt a same-named local file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.stylelintrc.json': '{"extends":"config/base.json"}\n',
        'config/base.json': '{"rules":{"color-named":"never"}}\n',
        'package.json': '{"private":true}\n',
    });
    symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
    expect(
        (
            await rejection(
                stylelint.lint({ code: 'a { color: red; }', configFile: join(sandbox.path, '.stylelintrc.json') }),
            )
        ).message,
    ).toContain('Could not find "config/base.json"');
    const refused = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
    expect(refused.removed).toStrictEqual([]);
    expect(refused.unread.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
    expect(refused.tools.size).toBe(0);
    await Bun.write(join(sandbox.path, '.stylelintrc.json'), '{"extends":"./config/base.json"}\n');
    const corrected = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
    expect(corrected.unread).toStrictEqual([]);
    expect(corrected.removed.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
});

test.each(['cycle', 'invalid options', 'external link'])(
    'Stylelint inheritance preserves originals after %s and accepts a corrected parent',
    async (failure) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        const original = '{"extends":"./config/base.json","rules":{"selector-max-id":0}}\n';
        const parent =
            failure === 'cycle'
                ? '{"extends":"../.stylelintrc.json"}\n'
                : '{"rules":{"color-named":"invalid-choice"}}\n';
        await createFileTree(sandbox.path, {
            '.stylelintrc.json': original,
            'package.json': '{"private":true}\n',
            'config/base.json': parent,
        });
        await createFileTree(external.path, { 'base.json': '{"rules":{"color-named":"never"}}\n' });
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        if (failure === 'external link') {
            rmSync(join(sandbox.path, 'config/base.json'));
            symlinkSync(join(external.path, 'base.json'), join(sandbox.path, 'config/base.json'));
        }
        const refused = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
        expect(refused.unread.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
        expect(refused.removed).toStrictEqual([]);
        expect(refused.tools.size).toBe(0);
        expect(readFileSync(join(sandbox.path, '.stylelintrc.json'), 'utf8')).toBe(original);
        expect(readFileSync(join(external.path, 'base.json'), 'utf8')).toBe('{"rules":{"color-named":"never"}}\n');
        rmSync(join(sandbox.path, 'config/base.json'));
        await Bun.write(join(sandbox.path, 'config/base.json'), '{"rules":{"color-named":"never"}}\n');
        const corrected = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
        expect(corrected.unread).toStrictEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
        expect(corrected.observed.get('config/base.json')?.bytes).toStrictEqual(
            readFileSync(join(sandbox.path, 'config/base.json')),
        );
    },
);

test.each(['absent', 'different version'])(
    'Stylelint adoption preserves configuration when its native validator is %s and succeeds after installation',
    async (state) => {
        await using sandbox = await testdir();
        const original = '{"rules":{"selector-max-id":0}}\n';
        await createFileTree(sandbox.path, {
            '.stylelintrc.json': original,
            'package.json': '{"private":true}\n',
            ...(state === 'absent'
                ? {}
                : { 'node_modules/stylelint/package.json': '{"name":"stylelint","version":"0.0.0"}\n' }),
        });
        const refused = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
        expect(refused.removed).toStrictEqual([]);
        expect(refused.unread.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
        expect(refused.tools.size).toBe(0);
        expect(readFileSync(join(sandbox.path, '.stylelintrc.json'), 'utf8')).toBe(original);
        rmSync(join(sandbox.path, 'node_modules'), { recursive: true, force: true });
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const corrected = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
        expect(corrected.unread).toStrictEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
    },
);

test.each([
    { rules: { 'unknown-rule': true } },
    { rules: { 'color-named': 'invalid-choice' } },
    { rules: { 'color-named': ['never', { message: null }] } },
    { rules: { 'color-named': 'never' }, extends: './other.json' },
])(
    'Stylelint preserves invalid or unsupported configuration %j and accepts corrected options',
    async (configuration) => {
        await using sandbox = await testdir();
        const original = JSON.stringify(configuration) + '\n';
        await createFileTree(sandbox.path, { '.stylelintrc.json': original, 'package.json': '{"private":true}\n' });
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const refused = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
        expect(refused.unread.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
        expect(refused.removed).toStrictEqual([]);
        expect(refused.tools.size).toBe(0);
        expect(readFileSync(join(sandbox.path, '.stylelintrc.json'), 'utf8')).toBe(original);
        await Bun.write(join(sandbox.path, '.stylelintrc.json'), '{"rules":{"color-named":"never"}}\n');
        const corrected = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
        expect(corrected.unread).toStrictEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
    },
);
