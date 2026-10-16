import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type Finding } from '#cli/types/checks/run/check.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';

import {
    README,
    LICENSE,
    DOC_TASK_FILES,
    DOC_TASK_SCOPES,
    DOC_TASK_FINDINGS,
    DOC_FENCE_PATH_CASES,
} from '#tests/data/checks/docs.ts';

async function collectDocsFindings(
    files: Record<string, string>,
    options: { paths?: string[] } = {},
): Promise<readonly Finding[]> {
    await using sandbox = await testdir({ 'gspot.toml': buildSettingsText(['docs'], { level: 'all' }), ...files });
    return await checkFindings(sandbox.path, 'docs/missing-paths', options);
}

test('missing-paths: wildcard examples are skipped; bold, italic and code paths are checked', async () => {
    const found = await collectDocsFindings(
        {
            'a.md': 'Outputs use `reports/report.*` or `src/*.ts`.\nSee **src/missing.ts**, *src/absent.ts*, and `src/gone.ts`.\n',
            'src/here.ts': '',
            'reports/README.md': '',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 2, rule: 'missing-path', message: matchSubstring('src/missing.ts') },
        { file: 'a.md', line: 2, rule: 'missing-path', message: matchSubstring('src/absent.ts') },
        { file: 'a.md', line: 2, rule: 'missing-path', message: matchSubstring('src/gone.ts') },
    ]);
});

test('missing-paths: gitignored literal paths count as present; missing paths are reported', async () => {
    const found = await collectDocsFindings(
        {
            'a.md': 'Build `output/report.json` and `app/cache`.\nSee `app/absent.ts` and `app/private.ts`.\n',
            '.gitignore': '/output/report.json\n',
            'app/.gitignore': 'cache/\n*.ts\n!private.ts\n',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 2, rule: 'missing-path', message: matchSubstring('app/absent.ts') },
        { file: 'a.md', line: 2, rule: 'missing-path', message: matchSubstring('app/private.ts') },
    ]);
});

test('missing-paths: command check names count as present; unknown ones are reported', async () => {
    const findings = await collectDocsFindings(
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
        findings.map(({ file, line, rule, message }) => ({
            file,
            line,
            rule,
            message,
        })),
    ).toStrictEqual([{ file: 'a.md', line: 1, rule: 'missing-path', message: matchSubstring('tests/missing') }]);
});

test('missing-paths: mise task aliases count; unknown aliases are reported', async () => {
    const found = await collectDocsFindings(
        {
            'a.md': 'Run `mise run compile`, `mise run verify`, `mise run validate`, and `mise run absent`.\n',
            'mise.toml':
                '[tasks.build]\nalias = "compile"\nrun = "true"\n[tasks.test]\nalias = ["verify", "validate"]\nrun = "true"\n',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 1, rule: 'missing-task', message: matchSubstring('mise run absent') },
    ]);
});

test('missing-paths: clone host names are skipped while missing repository paths are reported', async () => {
    const found = await collectDocsFindings({
        'README.md': 'Clone github.com/example/demo.git and read docs/guide.md.\n',
    });
    expect(found.map(({ message }) => message)).toStrictEqual(['docs/guide.md names no tracked file or folder.']);
});

test('missing-paths: mise file tasks include nested names while unknown tasks are reported', async () => {
    const found = await collectDocsFindings({
        'README.md': 'Run `mise run setup`, `mise run docs:build`, and `mise run absent`.\n',
        '.mise/tasks/setup': '#!/usr/bin/env bash\ntrue\n',
        '.mise/tasks/docs/build': '#!/usr/bin/env bash\ntrue\n',
    });
    expect(found.map(({ message }) => message)).toStrictEqual(['mise run absent names no task or script.']);
});

test('missing-paths: tasks in .mise/config.toml, mise.local.toml and conf.d files count, and .tool-versions is not read as TOML', async () => {
    const found = await collectDocsFindings(
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

test('missing-paths: paths relative to the document are found, and missing ones nearby are still reported', async () => {
    const found = await collectDocsFindings(
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

test('missing-paths: text in a quoted tilde fence is skipped while sh fences are checked', async () => {
    const found = await collectDocsFindings(
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
])('missing-paths: a malformed %s is a read error, not a missing task', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': 'Run `bun run build`.\n',
        [path]: path === 'package.json' ? '{}' : '',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildSettingsText(['docs'], { level: 'all' }));
    const session = await openSession(sandbox.path);
    await Bun.write(join(sandbox.path, path), text);
    session.reads = createReadCache(sandbox.path);
    const selected = buildCheckInput(session, 'docs/missing-paths', { paths: ['a.md'] });
    expect(() => CHECK_IMPLEMENTATIONS['docs/missing-paths'].check(selected)).toThrow(
        `Cannot read task definitions from ${path}.`,
    );
});

test('missing-paths: documented tasks are checked against their task tool and the nearest scope that defines them', async () => {
    const found = await collectDocsFindings({
        'gspot.toml': buildSettingsText([], { level: 'recommended', tables: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    expect(found).toHaveLength(DOC_TASK_FINDINGS.length);
    for (const { command, ...place } of DOC_TASK_FINDINGS)
        expect(found).toContainEqual(matchFields({ ...place, rule: 'missing-task', message: matchSubstring(command) }));
});

test('missing-paths: a document in a child scope does not read unrelated or shadowed package scripts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { tables: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, { 'package.json': '{broken', 'sibling/package.json': '{broken' });

    expect(
        CHECK_IMPLEMENTATIONS['docs/missing-paths'].check(
            buildCheckInput(session, 'docs/missing-paths', { paths: ['app/nested/guide.md'] }),
        ),
    ).toStrictEqual([]);
});

test.each([
    ['app/package.json', '{broken'],
    ['app/mise.toml', '[tasks'],
])('missing-paths: a document in a child scope reports a malformed %s at the file that has it', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { tables: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    const session = await openSession(sandbox.path);
    await Bun.write(join(sandbox.path, path), text);
    session.reads = createReadCache(sandbox.path);
    const input = buildCheckInput(session, 'docs/missing-paths', { paths: ['app/nested/guide.md'] });
    expect(() => CHECK_IMPLEMENTATIONS['docs/missing-paths'].check(input)).toThrow(
        `Cannot read task definitions from ${path}.`,
    );
});

test.each([...DOC_FENCE_PATH_CASES])(
    'missing-paths: a $language fence with "$metadata" reports example paths=$reported',
    async ({ metadata, language, reported }) => {
        const pathFindings = await collectDocsFindings(
            {
                'guide.md': `> ~~~${language} ${metadata}\n> cat src/example.ts\n> ~~~\n\nSee src/missing.ts.\n`,
            },
            { paths: ['guide.md'] },
        );
        expect(pathFindings.map(({ line, message }) => [line, message])).toStrictEqual([
            ...(reported ? [[2, 'src/example.ts names no tracked file or folder.']] : []),
            [5, 'src/missing.ts names no tracked file or folder.'],
        ]);
    },
);
test('required-files: a root without LICENSE is reported and passes once LICENSE exists', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['docs'], { level: 'all' }),
        'README.md': README,
    });
    const failed = await checkReport(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'docs/required-files',
            status: 'failed',
            findings: [{ file: 'LICENSE', message: 'The root has no LICENSE file.' }],
        },
    ]);
    await Bun.write(join(sandbox.path, 'LICENSE'), LICENSE);
    const corrected = await checkReport(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test.each(['COPYING', 'LICENCE', 'LICENSE-MIT', 'LICENSE.rst'])(
    'required-files: the license file %s counts as a LICENSE',
    async (name) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['docs'], { level: 'all' }),
            'README.md': README,
            [name]: LICENSE,
        });
        expect(await checkFindings(sandbox.path, 'docs/required-files')).toStrictEqual([]);
    },
);

test('required-files: a NOTICE file does not count as a LICENSE', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['docs'], { level: 'all' }),
        'README.md': README,
        NOTICE: 'Copyright Example',
    });
    expect(await checkFindings(sandbox.path, 'docs/required-files')).toMatchObject([
        { file: 'LICENSE', rule: 'missing-license' },
    ]);
});
