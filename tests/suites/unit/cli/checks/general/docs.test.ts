import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { README, LICENSE } from '#tests/config/checks/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

import {
    MDX_GUIDE,
    DOC_TASK_FILES,
    DOC_TASK_SCOPES,
    DOC_TASK_FINDINGS,
    MISE_TASK_SOURCES,
    IGNORED_PATH_FILES,
    LICENSE_FILE_CASES,
    RELATIVE_PATH_FILES,
    DOC_FENCE_PATH_CASES,
    MALFORMED_TASK_FILES,
    COVERAGE_CHECK_TABLES,
    RELATIVE_PATH_FINDINGS,
    MDX_MISSING_PATH_FINDINGS,
} from '#tests/config/checks/general/docs.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 9 calls in this file share it.
async function runMissingPathsCheck(
    files: Record<string, string>,
    options: { paths?: string[] } = {},
): Promise<readonly Finding[]> {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }), ...files });
    return await runSandboxCheck(sandbox.path, 'docs/missing-paths', options);
}

test('missing-paths: a path in an .mdx page that names no tracked file is reported', async () => {
    const found = await runMissingPathsCheck(
        { 'docs/guide.mdx': MDX_GUIDE, 'docs/example.ts': '' },
        { paths: ['docs/guide.mdx'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        ...MDX_MISSING_PATH_FINDINGS,
    ]);
});

test('missing-paths: wildcard examples are skipped; bold, italic and code paths are checked', async () => {
    const found = await runMissingPathsCheck(
        {
            'a.md': 'Outputs use `reports/report.*` or `src/*.ts`.\nSee **src/missing.ts**, *src/absent.ts*, and `src/gone.ts`.\n',
            'src/here.ts': '',
            'reports/README.md': '',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 2, rule: 'missing-path', message: 'src/missing.ts names no tracked file or folder.' },
        { file: 'a.md', line: 2, rule: 'missing-path', message: 'src/absent.ts names no tracked file or folder.' },
        { file: 'a.md', line: 2, rule: 'missing-path', message: 'src/gone.ts names no tracked file or folder.' },
    ]);
});

test('missing-paths: gitignored paths and paths inside ignored folders count as present; others are reported', async () => {
    const found = await runMissingPathsCheck(IGNORED_PATH_FILES, { paths: ['a.md'] });
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 2, rule: 'missing-path', message: 'app/private.ts names no tracked file or folder.' },
        { file: 'a.md', line: 2, rule: 'missing-path', message: 'src/gone.ts names no tracked file or folder.' },
    ]);
});

test('missing-paths: command check names count as present; unknown ones are reported', async () => {
    const findings = await runMissingPathsCheck(
        {
            'gspot.toml': buildSandboxSettings(['docs'], {
                level: 'all',
                tables: COVERAGE_CHECK_TABLES,
            }),
            'a.md': 'Run `tests/coverage` and `tests/missing`.\n',
            'tests/example.ts': '',
        },
        { paths: ['a.md'] },
    );
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 1, rule: 'missing-path', message: 'tests/missing names no tracked file or folder.' },
    ]);
});

test.each([...MISE_TASK_SOURCES])(
    'missing-paths: $name count, and an unknown task is reported',
    async ({ tasks, files }) => {
        const named = [...tasks, 'absent'].map((task) => '`mise run ' + task + '`').join(', ');
        const found = await runMissingPathsCheck({ 'a.md': `Run ${named}.\n`, ...files }, { paths: ['a.md'] });
        expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
            { file: 'a.md', line: 1, rule: 'missing-task', message: 'mise run absent names no task or script.' },
        ]);
    },
);

test('missing-paths: clone host names are skipped while missing repository paths are reported', async () => {
    const found = await runMissingPathsCheck({
        'README.md': 'Clone github.com/example/demo.git and read docs/guide.md.\n',
    });
    expect(found.map(({ message }) => message)).toStrictEqual(['docs/guide.md names no tracked file or folder.']);
});

test('missing-paths: paths relative to the document are found, and missing ones nearby are still reported', async () => {
    const found = await runMissingPathsCheck(RELATIVE_PATH_FILES, { paths: ['docs/guide.md'] });
    expect(found.map(({ line, message: description }) => [line, description])).toStrictEqual([
        ...RELATIVE_PATH_FINDINGS,
    ]);
});

test.each([...MALFORMED_TASK_FILES])(
    'missing-paths: a malformed $path is a read error, not a missing task',
    async ({ path, text, document, scopes, files, message }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docs'], { level: 'all', scopes }),
            ...files,
        });

        const session = await openSession(sandbox.path);
        await writeFile(join(sandbox.path, path), text);
        session.reads = createReadCache(sandbox.path);
        const input = planSandboxCheck(session, 'docs/missing-paths', { paths: [document] });
        const failure = await captureRejection(findBuiltInCheck('docs/missing-paths')(session, input));
        expect(failure.message).toBe(message);
    },
);

test('missing-paths: documented tasks are checked against their task tool and the nearest scope that defines them', async () => {
    const found = await runMissingPathsCheck({
        'gspot.toml': buildSandboxSettings([], { level: 'recommended', scopes: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        ...DOC_TASK_FINDINGS,
    ]);
});

test('missing-paths: a document in a child scope does not read unrelated or shadowed package scripts', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { scopes: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });

    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, { 'package.json': '{broken', 'sibling/package.json': '{broken' });
    session.reads = createReadCache(sandbox.path);

    expect(
        await findBuiltInCheck('docs/missing-paths')(
            session,
            planSandboxCheck(session, 'docs/missing-paths', { paths: ['app/nested/guide.md'] }),
        ),
    ).toStrictEqual([]);
});

test.each([...DOC_FENCE_PATH_CASES])(
    'missing-paths: a $language fence with "$info" reports example paths=$reported',
    async ({ info, language, reported }) => {
        const pathFindings = await runMissingPathsCheck(
            {
                'guide.md': `> ~~~${language} ${info}\n> cat src/example.ts\n> ~~~\n\nSee src/missing.ts.\n`,
            },
            { paths: ['guide.md'] },
        );
        expect(pathFindings.map(({ line, message }) => [line, message])).toStrictEqual([
            ...(reported ? [[2, 'src/example.ts names no tracked file or folder.']] : []),
            [5, 'src/missing.ts names no tracked file or folder.'],
        ]);
    },
);

test.each([...LICENSE_FILE_CASES])(
    'required-files: $name counts as a LICENSE only when it is one',
    async ({ name, findings }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
            'README.md': README,
            [name]: LICENSE,
        });
        const found = await runSandboxCheck(sandbox.path, 'docs/required-files');
        expect(found.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([...findings]);
    },
);

test('required-files: ignored README.md and LICENSE files in a Git repository are reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        '.gitignore': 'README.md\nLICENSE\n',
        'README.md': README,
        LICENSE,
        'guide.md': 'Project documentation.\n',
    });
    commitAll(sandbox.path);
    const found = await runSandboxCheck(sandbox.path, 'docs/required-files');
    expect(found.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: 'README.md', rule: 'missing-readme', message: 'The scope root has no README.md.' },
        { file: 'LICENSE', rule: 'missing-license', message: 'The root has no LICENSE file.' },
    ]);

    await writeFile(join(sandbox.path, '.gitignore'), '');
    expect(await runSandboxCheck(sandbox.path, 'docs/required-files')).toStrictEqual([]);
});

test('required-files: a scope without README.md is reported and passes once README.md exists', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all', scopes: [{ path: 'app' }] }),
        'README.md': README,
        LICENSE,
        'app/package.json': '{}',
    });
    const found = await runSandboxCheck(sandbox.path, 'docs/required-files', { scope: 'app' });
    expect(found.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: 'app/README.md', rule: 'missing-readme', message: 'The scope app has no README.md.' },
    ]);
    await writeFile(join(sandbox.path, 'app/README.md'), README);
    expect(await runSandboxCheck(sandbox.path, 'docs/required-files', { scope: 'app' })).toStrictEqual([]);
});
