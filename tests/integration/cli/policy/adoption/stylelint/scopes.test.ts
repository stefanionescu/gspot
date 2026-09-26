import { join } from 'node:path';
import stylelint from 'stylelint';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { readFileSync, symlinkSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';
import { STYLELINT_TOOLING } from '#tests/support/cli/stylelint.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';

test.each([
    { paths: ['app/**'], disabled: true },
    { paths: ['app/*.css'], disabled: false },
    { paths: ['app/**', '!app/protected/**'], disabled: false },
    { paths: ['application/**'], disabled: false },
])('scope configuration preserves partial selectors $paths', async ({ paths, disabled }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'app/deep/sample.css': 'a {}\n',
        'gspot.toml': stringify({
            version: 1,
            configurations: ['css'],
            scope: [
                { path: 'app', configurations: [] },
                { path: 'app/deep', configurations: [] },
            ],
            ignore: [
                {
                    check: 'css/stylelint',
                    rule: 'block-no-empty',
                    paths,
                    reason: 'The selected style fixtures contain empty blocks.',
                },
            ],
        }),
    });
    const session = await openSession(sandbox.path);
    expect(session.scopes[0]!.view.rulesOff('css/stylelint')).toStrictEqual([]);
    for (const scope of session.scopes.filter(({ scope }) => scope.path !== ''))
        expect(scope.view.rulesOff('css/stylelint')).toStrictEqual(disabled ? ['block-no-empty'] : []);
});

test('nested Stylelint adoption preserves sibling rules and whole-scope allowances in native editor configurations', async () => {
    await using sandbox = await testdir();
    const original = '{"extends":"./base.json","rules":{"block-no-empty":null}}\n';
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true}\n',
        'theme[1]/.stylelintrc.json': original,
        'theme[1]/base.json': '{"rules":{"color-named":"never","selector-max-id":0}}\n',
        'other/.stylelintrc.json': '{"rules":{"color-named":"always-where-possible","selector-max-id":2}}\n',
        'theme[1]/sample.css': 'a {}\n',
        'theme[1]/deep/sample.css': 'a {}\n',
        'other/sample.css': 'a {}\n',
        'sample.css': 'a {}\n',
    });
    symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
    const discovered: ExistingTooling = {
        ...STYLELINT_TOOLING,
        configs: ['theme[1]', 'other'].map((scope) => ({
            tool: 'stylelint',
            path: `${scope}/.stylelintrc.json`,
            carries: 'rules-table',
            check: 'css/stylelint',
        })),
    };
    const carried = await collectCarried(sandbox.path, discovered, new Set(['css']), []);
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map(({ path }) => path)).toStrictEqual([
        'theme[1]/.stylelintrc.json',
        'other/.stylelintrc.json',
    ]);
    expect(carried.tools.get('stylelint')?.settings).toStrictEqual({});
    expect(carried.observed.has('theme[1]/base.json')).toBe(true);
    const samples = [
        { path: 'theme[1]/future.css', code: '#example { color: red; }', expected: ['color-named', 'selector-max-id'] },
        { path: 'other/future.css', code: '#example { color: red; }', expected: [] },
        { path: 'theme[1]/future.css', code: 'a {}', expected: [] },
        { path: 'theme[1]/deep/future.css', code: 'a {}', expected: [] },
        { path: 'other/future.css', code: 'a {}', expected: ['block-no-empty'] },
        { path: 'future.css', code: 'a {}', expected: ['block-no-empty'] },
        { path: 'theme[1]/corrected.css', code: '.example { color: #abc; }', expected: [] },
    ];
    const baseline = await stylelint.lint({ code: 'a {}', codeFilename: join(sandbox.path, 'theme[1]/future.css') });
    expect(baseline.results.flatMap((result) => result.warnings)).toStrictEqual([]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        proposeText({
            configurations: ['css'],
            scopes: [{ path: 'theme[1]/deep', configurations: ['css'] }],
            carried,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        }),
    );
    const session = await openSession(sandbox.path);
    for (const file of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.filter((file) => file.kind === 'config' || file.path.endsWith('.stylelintrc.json')))
        await Bun.write(join(sandbox.path, file.path), file.content);
    for (const { path, code, expected } of samples) {
        const result = await stylelint.lint({ code, codeFilename: join(sandbox.path, path) });
        const relevant = result.results
            .flatMap((result) => result.warnings.map((warning) => warning.rule))
            .filter((rule) => ['color-named', 'selector-max-id', 'block-no-empty'].includes(rule))
            .toSorted((left, right) => left.localeCompare(right));
        expect(relevant, path).toStrictEqual(expected);
    }
    expect(readFileSync(join(sandbox.path, 'theme[1]/base.json'), 'utf8')).toBe(
        '{"rules":{"color-named":"never","selector-max-id":0}}\n',
    );
});

test('overlapping Stylelint sources preserve every original before adoption', async () => {
    await using sandbox = await testdir();
    const original = '{"rules":{"color-named":"never"}}\n';
    await createFileTree(sandbox.path, { '.stylelintrc.json': original, 'nested/.stylelintrc.json': original });
    const carried = await collectCarried(
        sandbox.path,
        {
            ...STYLELINT_TOOLING,
            configs: [
                ...STYLELINT_TOOLING.configs,
                { tool: 'stylelint', path: 'nested/.stylelintrc.json', carries: 'rules-table', check: 'css/stylelint' },
            ],
        },
        new Set(['css']),
        [],
    );
    expect(carried.unread).toContainEqual(
        expect.objectContaining({ path: '.stylelintrc.json', note: expect.stringContaining('Overlapping') }),
    );
    expect(carried.removed).toStrictEqual([]);
    expect(carried.scopes.size).toBe(0);
    for (const path of ['.stylelintrc.json', 'nested/.stylelintrc.json'])
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(original);
});
