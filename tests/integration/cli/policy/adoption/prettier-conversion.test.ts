// Carried Prettier ignore files and negated override selectors keep their meaning for files created after adoption.
import prettier from 'prettier';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { evaluateFormat } from '#cli/evaluation/format.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { TEXT, TOOLING } from '#tests/constants/integration/cli/policy/adoption.ts';

test('nested Prettier ignore files convert with Git precedence for files created later', async () => {
    await using directory = await testdir();
    const ignores = {
        '.prettierignore': 'generated/\n*.log.js\n',
        'packages/app/.prettierignore':
            '# The test runner writes snapshots.\n*.snap.js\n/build\nsrc/*\n!src/keep.js\n!*.log.js\n',
    };
    await createFileTree(directory.path, { '.prettierrc.json': '{"semi":false}', ...ignores });
    const configs = [
        { tool: 'prettier', path: '.prettierrc.json', carries: 'rules-table' as const },
        ...Object.keys(ignores).map((path) => ({ tool: 'prettier', path, carries: 'ignore-paths' as const })),
    ];
    const carried = await collectCarried(directory.path, { configs, ...TOOLING }, new Set(['formatting']), []);
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map(({ path }) => path)).toStrictEqual(['.prettierrc.json', ...Object.keys(ignores)]);
    const tools = { prettier: { ignore_patterns: carried.formatter!.ignorePatterns } };
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['formatting'], format: carried.formatter!.format, tools }),
    );
    const session = await openSession(directory.path);
    const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
        takeover: carried.observed,
    }).files.find(({ path }) => path === '.prettierignore')!;
    writeFileSync(join(directory.path, '.prettierignore'), generated.content);
    const expected = {
        'generated/a.js': true,
        'root.log.js': true,
        'packages/app/x.snap.js': true,
        'packages/app/deep/y.snap.js': true,
        'other/z.snap.js': false,
        'packages/app/build/a.js': true,
        'packages/app/deep/build/a.js': false,
        'packages/app/src/a.js': true,
        'packages/app/src/keep.js': false,
        'packages/app/trace.log.js': false,
    };
    const ignorePath = join(directory.path, '.prettierignore');
    const observed = await Promise.all(
        Object.keys(expected).map(async (path) => {
            const info = await prettier.getFileInfo(join(directory.path, path), { ignorePath });
            return [path, info.ignored] as const;
        }),
    );
    expect(Object.fromEntries(observed)).toStrictEqual(expected);
});

test('negated override selectors of the root configuration keep their meaning in generated configuration', async () => {
    await using directory = await testdir();
    const source = {
        semi: false,
        overrides: [
            { files: ['src/**/*.js', '!src/legacy/**'], options: { tabWidth: 8 } },
            { files: 'src/**/*.js', excludeFiles: ['!src/keep/**'], options: { singleQuote: true } },
        ],
    };
    await createFileTree(directory.path, { '.prettierrc.json': JSON.stringify(source) });
    const carried = await evaluateFormat({ root: directory.path, from: '.prettierrc.json', source });
    const tools = { prettier: { extra: carried.extra } };
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['formatting'], format: carried.format, tools }),
    );
    const session = await openSession(directory.path);
    const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.find(({ path }) => path === '.gspot/config/prettier.json')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    for (const path of ['src/a.js', 'src/legacy/b.js', 'src/keep/c.js', 'lib/d.js']) {
        const filepath = join(directory.path, path);
        const before = await prettier.resolveConfig(filepath, { useCache: false });
        const config = join(directory.path, generated.path);
        const after = await prettier.resolveConfig(filepath, { config, useCache: false });
        expect(await prettier.format(TEXT, { ...after, filepath }), path).toBe(
            await prettier.format(TEXT, { ...before, filepath }),
        );
    }
});

test('negated override selectors of a nested configuration stay inside its folder', async () => {
    await using directory = await testdir();
    const configs = {
        '.prettierrc.json': JSON.stringify({ semi: false }),
        'packages/app/.prettierrc.json': JSON.stringify({
            overrides: [
                { files: ['*.js', '!*.test.js'], options: { tabWidth: 8 } },
                { files: 'lib/**/*.js', excludeFiles: ['!lib/keep/**'], options: { semi: false } },
            ],
        }),
    };
    await createFileTree(directory.path, configs);
    const tooling = {
        configs: Object.keys(configs).map((path) => ({ tool: 'prettier', path, carries: 'rules-table' as const })),
        ...TOOLING,
    };
    const carried = await collectCarried(directory.path, tooling, new Set(['formatting']), []);
    expect(carried.unread).toStrictEqual([]);
    const tools = { prettier: { extra: carried.formatter?.extra } };
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['formatting'], format: carried.formatter?.format, tools }),
    );
    const session = await openSession(directory.path);
    const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.find(({ path }) => path === '.gspot/config/prettier.json')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const paths = [
        'packages/app/a.js',
        'packages/app/a.test.js',
        'packages/app/deep/b.test.js',
        'packages/app/lib/c.js',
        'packages/app/lib/keep/d.js',
        'other/e.test.js',
        'other/f.js',
    ];
    for (const path of paths) {
        const filepath = join(directory.path, path);
        const before = await prettier.resolveConfig(filepath, { useCache: false });
        const config = join(directory.path, generated.path);
        const after = await prettier.resolveConfig(filepath, { config, useCache: false });
        expect(await prettier.format(TEXT, { ...after, filepath }), path).toBe(
            await prettier.format(TEXT, { ...before, filepath }),
        );
    }
});
