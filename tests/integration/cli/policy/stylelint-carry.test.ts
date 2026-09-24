import { join } from 'node:path';
import { readFileSync, rmSync, symlinkSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import stylelint from 'stylelint';
import { stringify } from 'smol-toml';
import { collectCarried } from '#cli/lifecycle/takeover.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { proposeText } from '#cli/policy/propose.ts';
import type { ExistingTooling } from '#cli/types/repository.ts';

const modules = join(import.meta.dir, '../../../../node_modules');
const tooling: ExistingTooling = {
    configs: [{ tool: 'stylelint', path: '.stylelintrc.json', carries: 'rules-table', check: 'css/stylelint' }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};

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
    expect(session.scopes[0]!.view.rulesOff('css/stylelint')).toEqual([]);
    for (const scope of session.scopes.filter(({ scope }) => scope.path !== ''))
        expect(scope.view.rulesOff('css/stylelint')).toEqual(disabled ? ['block-no-empty'] : []);
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
    symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
    const discovered: ExistingTooling = {
        ...tooling,
        configs: ['theme[1]', 'other'].map((scope) => ({
            tool: 'stylelint',
            path: `${scope}/.stylelintrc.json`,
            carries: 'rules-table',
            check: 'css/stylelint',
        })),
    };
    const carried = await collectCarried(sandbox.path, discovered, new Set(['css']), []);
    expect(carried.unread).toEqual([]);
    expect(carried.removed.map(({ path }) => path)).toEqual(['theme[1]/.stylelintrc.json', 'other/.stylelintrc.json']);
    expect(carried.tools.get('stylelint')?.settings).toEqual({});
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
    expect(baseline.results.flatMap((result) => result.warnings)).toEqual([]);
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
    for (const file of emitAll(session).files.filter(
        (file) => file.kind === 'config' || file.path.endsWith('.stylelintrc.json'),
    ))
        await Bun.write(join(sandbox.path, file.path), file.content);
    for (const { path, code, expected } of samples) {
        const result = await stylelint.lint({ code, codeFilename: join(sandbox.path, path) });
        const relevant = result.results
            .flatMap((result) => result.warnings.map((warning) => warning.rule))
            .filter((rule) => ['color-named', 'selector-max-id', 'block-no-empty'].includes(rule))
            .sort();
        expect(relevant, path).toEqual(expected);
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
            ...tooling,
            configs: [
                ...tooling.configs,
                { tool: 'stylelint', path: 'nested/.stylelintrc.json', carries: 'rules-table', check: 'css/stylelint' },
            ],
        },
        new Set(['css']),
        [],
    );
    expect(carried.unread).toContainEqual(
        expect.objectContaining({ path: '.stylelintrc.json', note: expect.stringContaining('Overlapping') }),
    );
    expect(carried.removed).toEqual([]);
    expect(carried.scopes.size).toBe(0);
    for (const path of ['.stylelintrc.json', 'nested/.stylelintrc.json'])
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(original);
});

test('Stylelint package lookups do not adopt a same-named local file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.stylelintrc.json': '{"extends":"config/base.json"}\n',
        'config/base.json': '{"rules":{"color-named":"never"}}\n',
        'package.json': '{"private":true}\n',
    });
    symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
    await expect(
        stylelint.lint({ code: 'a { color: red; }', configFile: join(sandbox.path, '.stylelintrc.json') }),
    ).rejects.toThrow('Could not find "config/base.json"');
    const refused = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
    expect(refused.removed).toEqual([]);
    expect(refused.unread.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
    expect(refused.tools.size).toBe(0);
    await Bun.write(join(sandbox.path, '.stylelintrc.json'), '{"extends":"./config/base.json"}\n');
    const corrected = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
    expect(corrected.unread).toEqual([]);
    expect(corrected.removed.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
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
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        if (failure === 'external link') {
            rmSync(join(sandbox.path, 'config/base.json'));
            symlinkSync(join(external.path, 'base.json'), join(sandbox.path, 'config/base.json'));
        }
        const refused = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
        expect(refused.unread.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
        expect(refused.removed).toEqual([]);
        expect(refused.tools.size).toBe(0);
        expect(readFileSync(join(sandbox.path, '.stylelintrc.json'), 'utf8')).toBe(original);
        expect(readFileSync(join(external.path, 'base.json'), 'utf8')).toBe('{"rules":{"color-named":"never"}}\n');
        rmSync(join(sandbox.path, 'config/base.json'));
        await Bun.write(join(sandbox.path, 'config/base.json'), '{"rules":{"color-named":"never"}}\n');
        const corrected = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
        expect(corrected.unread).toEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
        expect(corrected.observed.get('config/base.json')?.bytes).toEqual(
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
        const refused = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
        expect(refused.removed).toEqual([]);
        expect(refused.unread.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
        expect(refused.tools.size).toBe(0);
        expect(readFileSync(join(sandbox.path, '.stylelintrc.json'), 'utf8')).toBe(original);
        rmSync(join(sandbox.path, 'node_modules'), { recursive: true, force: true });
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        const corrected = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
        expect(corrected.unread).toEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
    },
);

test.each([false, true])(
    'Stylelint adoption preserves enabled options, zero limits, and disabled rules for future files (inherited: %s)',
    async (inherited) => {
        await using sandbox = await testdir();
        const rules = {
            'color-named': ['never', { ignore: ['inside-function'] }],
            'selector-max-id': 0,
            'color-no-invalid-hex': null,
            'block-no-empty': [null],
        };
        const original =
            JSON.stringify(
                inherited
                    ? { extends: ['./config/base.json', './config/override.yml'], rules: { 'selector-max-id': 0 } }
                    : { rules },
            ) + '\n';
        await createFileTree(sandbox.path, {
            '.stylelintrc.json': original,
            'package.json': '{"private":true}\n',
            ...(inherited
                ? {
                      'config/base.json': JSON.stringify({
                          rules: { ...rules, 'color-named': 'always-where-possible', 'selector-max-id': 2 },
                      }),
                      'config/override.yml':
                          'extends: ./shared/leaf.json\nrules:\n  color-named: [never, {ignore: [inside-function]}]\n',
                      'config/shared/leaf.json': '{"rules":{"selector-max-id":1}}\n',
                  }
                : {}),
        });
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        const carried = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
        expect(carried.unread).toEqual([]);
        expect(carried.removed.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            stringify({
                version: 1,
                level: 'all',
                configurations: ['css'],
                rules: { install: false },
                tools: { stylelint: carried.tools.get('stylelint')!.settings },
                ignore: carried.tools.get('stylelint')!.ignores,
            }),
        );
        const session = await openSession(sandbox.path);
        const generated = emitAll(session).files.find((file) => file.path === '.gspot/config/stylelint.json')!;
        for (const code of ['#example { color: red; }', 'a { color: #abc; }', 'a { color: #ggg; }', 'a {}']) {
            const before = await stylelint.lint({ code, configFile: join(sandbox.path, '.stylelintrc.json') });
            const after = await stylelint.lint({
                code,
                codeFilename: join(sandbox.path, 'future.css'),
                config: JSON.parse(generated.content),
                configBasedir: sandbox.path,
            });
            const findings = after.results
                .flatMap((result) => result.warnings)
                .filter((warning) => Object.hasOwn(rules, warning.rule));
            expect(findings).toHaveLength(code.startsWith('#') ? 2 : 0);
            expect(findings.map(({ rule, line, column }) => ({ rule, line, column }))).toEqual(
                before.results
                    .flatMap((result) => result.warnings)
                    .map(({ rule, line, column }) => ({ rule, line, column })),
            );
            expect(after.results.flatMap((result) => result.invalidOptionWarnings)).toEqual([]);
        }
        expect(readFileSync(join(sandbox.path, '.stylelintrc.json'), 'utf8')).toBe(original);
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
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        const refused = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
        expect(refused.unread.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
        expect(refused.removed).toEqual([]);
        expect(refused.tools.size).toBe(0);
        expect(readFileSync(join(sandbox.path, '.stylelintrc.json'), 'utf8')).toBe(original);
        await Bun.write(join(sandbox.path, '.stylelintrc.json'), '{"rules":{"color-named":"never"}}\n');
        const corrected = await collectCarried(sandbox.path, tooling, new Set(['css']), []);
        expect(corrected.unread).toEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toEqual(['.stylelintrc.json']);
    },
);
