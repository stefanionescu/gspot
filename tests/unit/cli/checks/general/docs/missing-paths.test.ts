import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';
import { DOC_TASK_FILES, DOC_TASK_SCOPES, DOC_TASK_FINDINGS, DOC_FENCE_PATH_CASES } from '#tests/config/docs.ts';

async function missingPathFindings(
    files: Record<string, string>,
    options: { paths?: string[] } = {},
): Promise<readonly Finding[]> {
    await using sandbox = await testdir({ 'gspot.toml': settingsText(['docs'], { level: 'all' }), ...files });
    return await checkFindings(sandbox.path, 'docs/missing-paths', options);
}

test('wildcard examples are skipped; bold, italic and code paths are checked', async () => {
    const found = await missingPathFindings(
        {
            'a.md': 'Outputs use `reports/report.*` or `src/*.ts`.\nSee **src/missing.ts**, *src/absent.ts*, and `src/gone.ts`.\n',
            'src/here.ts': '',
            'reports/README.md': '',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 2, rule: 'missing-path', message: textContaining('src/missing.ts') },
        { file: 'a.md', line: 2, rule: 'missing-path', message: textContaining('src/absent.ts') },
        { file: 'a.md', line: 2, rule: 'missing-path', message: textContaining('src/gone.ts') },
    ]);
});

test('gitignored literal paths count as present; missing paths are reported', async () => {
    const found = await missingPathFindings(
        {
            'a.md': 'Build `output/report.json` and `app/cache`.\nSee `app/absent.ts` and `app/private.ts`.\n',
            '.gitignore': '/output/report.json\n',
            'app/.gitignore': 'cache/\n*.ts\n!private.ts\n',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 2, rule: 'missing-path', message: textContaining('app/absent.ts') },
        { file: 'a.md', line: 2, rule: 'missing-path', message: textContaining('app/private.ts') },
    ]);
});

test('command check names count as present; unknown ones are reported', async () => {
    const awaitedFindings = await missingPathFindings(
        {
            'gspot.toml': stringify({
                level: 'all',
                configurations: ['docs'],
                command_check: [{ name: 'tests/coverage', command: ['true'], paths: ['tests/**'], stage: 'manual' }],
            }),
            'a.md': 'Run `tests/coverage` and `tests/missing`.\n',
            'tests/example.ts': '',
        },
        { paths: ['a.md'] },
    );
    expect(
        awaitedFindings.map(({ file, line, rule, message }) => ({
            file,
            line,
            rule,
            message,
        })),
    ).toStrictEqual([{ file: 'a.md', line: 1, rule: 'missing-path', message: textContaining('tests/missing') }]);
});

test('mise task aliases count; unknown aliases are reported', async () => {
    const found = await missingPathFindings(
        {
            'a.md': 'Run `mise run compile`, `mise run verify`, `mise run validate`, and `mise run absent`.\n',
            'mise.toml':
                '[tasks.build]\nalias = "compile"\nrun = "true"\n[tasks.test]\nalias = ["verify", "validate"]\nrun = "true"\n',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 1, rule: 'missing-task', message: textContaining('mise run absent') },
    ]);
});

test('clone host names are skipped while missing repository paths are reported', async () => {
    const found = await missingPathFindings({
        'README.md': 'Clone github.com/example/demo.git and read docs/guide.md.\n',
    });
    expect(found.map(({ message }) => message)).toStrictEqual(['docs/guide.md names no tracked file or folder.']);
});

test('mise file tasks include nested names while unknown tasks are reported', async () => {
    const found = await missingPathFindings({
        'README.md': 'Run `mise run setup`, `mise run docs:build`, and `mise run absent`.\n',
        '.mise/tasks/setup': '#!/usr/bin/env bash\ntrue\n',
        '.mise/tasks/docs/build': '#!/usr/bin/env bash\ntrue\n',
    });
    expect(found.map(({ message }) => message)).toStrictEqual(['mise run absent names no task or script.']);
});

test('tasks in .mise/config.toml, mise.local.toml and conf.d files count, and .tool-versions is not read as TOML', async () => {
    const found = await missingPathFindings(
        {
            'a.md': 'Run `mise run config-task`, `mise run local-task`, `mise run included-task`, and `mise run absent`.\n',
            '.mise/config.toml': '[tasks.config-task]\nrun = "true"\n',
            'mise.local.toml': '[tasks.local-task]\nrun = "true"\n',
            '.mise/conf.d/project.toml': '[tasks.included-task]\nrun = "true"\n',
            '.tool-versions': 'node 22\n',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ message: description }) => description)).toStrictEqual([
        'mise run absent names no task or script.',
    ]);
});

test('paths relative to the document are found, and missing ones nearby are still reported', async () => {
    const found = await missingPathFindings(
        {
            'docs/guide.md':
                'See `./examples/good.ts`, `../src/here.ts`, and `src/here.ts`.\nSee `./examples/gone.ts` and `../src/gone.ts`.\nSee `./src/here.ts` and `./missing/`.\n',
            'docs/examples/good.ts': '',
            'src/here.ts': '',
        },
        { paths: ['docs/guide.md'] },
    );
    expect(found.map(({ line, message: description }) => [line, description])).toStrictEqual([
        [2, './examples/gone.ts names no tracked file or folder.'],
        [2, '../src/gone.ts names no tracked file or folder.'],
        [3, './src/here.ts names no tracked file or folder.'],
        [3, './missing/ names no tracked file or folder.'],
    ]);
});

test('text in a quoted tilde fence is skipped while sh fences are checked', async () => {
    const found = await missingPathFindings(
        { 'a.md': '> ~~~text\n> src/example.ts\n> ~~~~\n\n~~~sh\ncat src/missing.ts\n~~~\n' },
        { paths: ['a.md'] },
    );
    expect(found.map((finding) => [finding.line, finding.message])).toStrictEqual([
        [6, 'src/missing.ts names no tracked file or folder.'],
    ]);
});

test.each([
    ['package.json', '{broken'],
    ['mise.toml', '[tasks'],
])('a malformed %s is a read error, not a missing task', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': 'Run `bun run build`.\n',
        [path]: path === 'package.json' ? '{}' : '',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), settingsText(['docs'], { level: 'all' }));
    const session = await openSession(sandbox.path);
    await Bun.write(join(sandbox.path, path), text);
    session.reads = createReadCache(sandbox.path);
    const selected = buildCheckInput(session, 'docs/missing-paths', { paths: ['a.md'] });
    expect(() => CHECK_FUNCTIONS['docs/missing-paths'](selected)).toThrow(`Cannot read task definitions from ${path}.`);
});

test('documented tasks are checked against their task tool and the nearest scope that defines them', async () => {
    const found = await missingPathFindings({
        'gspot.toml': settingsText([], { level: 'recommended', tables: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    expect(found).toHaveLength(DOC_TASK_FINDINGS.length);
    for (const { command, ...place } of DOC_TASK_FINDINGS)
        expect(found).toContainEqual(containing({ ...place, rule: 'missing-task', message: textContaining(command) }));
});

test('a document in a child scope does not read unrelated or shadowed package scripts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], { tables: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, { 'package.json': '{broken', 'sibling/package.json': '{broken' });

    expect(
        CHECK_FUNCTIONS['docs/missing-paths'](
            buildCheckInput(session, 'docs/missing-paths', { paths: ['app/nested/guide.md'] }),
        ),
    ).toStrictEqual([]);
});

test.each([
    ['app/package.json', '{broken'],
    ['app/mise.toml', '[tasks'],
])('a document in a child scope reports a malformed %s at the file that has it', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], { tables: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    const session = await openSession(sandbox.path);
    await Bun.write(join(sandbox.path, path), text);
    session.reads = createReadCache(sandbox.path);
    const input = buildCheckInput(session, 'docs/missing-paths', { paths: ['app/nested/guide.md'] });
    expect(() => CHECK_FUNCTIONS['docs/missing-paths'](input)).toThrow(`Cannot read task definitions from ${path}.`);
});

test.each([...DOC_FENCE_PATH_CASES])(
    'a $language fence with "$metadata" reports example paths=$reported',
    async ({ metadata, language, reported }) => {
        const nextAwaitedFindings = await missingPathFindings(
            {
                'guide.md': `> ~~~${language} ${metadata}\n> cat src/example.ts\n> ~~~\n\nSee src/missing.ts.\n`,
            },
            { paths: ['guide.md'] },
        );
        expect(nextAwaitedFindings.map(({ line, message }) => [line, message])).toStrictEqual([
            ...(reported ? [[2, 'src/example.ts names no tracked file or folder.']] : []),
            [5, 'src/missing.ts names no tracked file or folder.'],
        ]);
    },
);
