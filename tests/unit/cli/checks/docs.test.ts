import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { readFile, writeFile } from 'node:fs/promises';
import { type Finding } from '#cli/types/runs/check.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { checkFindings, buildCheckInput, findBuiltInCheck } from '#tests/setup/check-input.ts';

import {
    README,
    LICENSE,
    MDX_GUIDE,
    DOC_TASK_FILES,
    DOC_TASK_SCOPES,
    DOC_TASK_FINDINGS,
    MISE_TASK_SOURCES,
    LICENSE_FILE_CASES,
    DOC_FENCE_PATH_CASES,
    MALFORMED_TASK_FILES,
} from '#tests/data/checks/docs.ts';

async function collectDocsFindings(
    files: Record<string, string>,
    options: { paths?: string[] } = {},
): Promise<readonly Finding[]> {
    await using sandbox = await testdir({ 'gspot.toml': buildSettingsText(['docs'], { level: 'all' }), ...files });
    return await checkFindings(sandbox.path, 'docs/missing-paths', options);
}

test('missing-paths: a path in an .mdx page that names no tracked file is reported', async () => {
    const found = await collectDocsFindings(
        { 'docs/guide.mdx': MDX_GUIDE, 'docs/example.ts': '' },
        { paths: ['docs/guide.mdx'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'docs/guide.mdx',
            line: 5,
            rule: 'missing-path',
            message: './missing.ts names no tracked file or folder.',
        },
    ]);
});

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

test('missing-paths: gitignored paths and paths inside ignored folders count as present; others are reported', async () => {
    const found = await collectDocsFindings(
        {
            'a.md': 'Build `output/report.json` and `app/cache`.\nSee `app/absent.ts`, `app/private.ts`, `.next/types/routes.d.ts`, and `src/gone.ts`.\n',
            '.gitignore': '/output/report.json\n.next/\n',
            'app/.gitignore': 'cache/\n*.ts\n!private.ts\n',
            'src/here.ts': '',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 2, rule: 'missing-path', message: matchSubstring('app/private.ts') },
        { file: 'a.md', line: 2, rule: 'missing-path', message: matchSubstring('src/gone.ts') },
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

test.each([...MISE_TASK_SOURCES])(
    'missing-paths: $name count, and an unknown task is reported',
    async ({ tasks, files }) => {
        const named = [...tasks, 'absent'].map((task) => '`mise run ' + task + '`').join(', ');
        const found = await collectDocsFindings({ 'a.md': `Run ${named}.\n`, ...files }, { paths: ['a.md'] });
        expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
            { file: 'a.md', line: 1, rule: 'missing-task', message: 'mise run absent names no task or script.' },
        ]);
    },
);

test('missing-paths: clone host names are skipped while missing repository paths are reported', async () => {
    const found = await collectDocsFindings({
        'README.md': 'Clone github.com/example/demo.git and read docs/guide.md.\n',
    });
    expect(found.map(({ message }) => message)).toStrictEqual(['docs/guide.md names no tracked file or folder.']);
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

test.each([...MALFORMED_TASK_FILES])(
    'missing-paths: a malformed $path is a read error, not a missing task',
    async ({ path, text, document, tables, files }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['docs'], { level: 'all', tables }),
            ...files,
        });
        const session = await openSession(sandbox.path);
        await Bun.write(join(sandbox.path, path), text);
        session.reads = createReadCache(sandbox.path);
        const input = buildCheckInput(session, 'docs/missing-paths', { paths: [document] });
        expect(() => findBuiltInCheck('docs/missing-paths')(input)).toThrow(
            `Cannot read task definitions from ${path}.`,
        );
    },
);

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
        await findBuiltInCheck('docs/missing-paths')(
            buildCheckInput(session, 'docs/missing-paths', { paths: ['app/nested/guide.md'] }),
        ),
    ).toStrictEqual([]);
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

test.each([...LICENSE_FILE_CASES])(
    'required-files: $name counts as a LICENSE only when it is one',
    async ({ name, findings }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['docs'], { level: 'all' }),
            'README.md': README,
            [name]: LICENSE,
        });
        const found = await checkFindings(sandbox.path, 'docs/required-files');
        expect(found.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([...findings]);
    },
);

test('required-files: ignored README.md and LICENSE files in a Git repository are reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['docs'], { level: 'all' }),
        '.gitignore': 'README.md\nLICENSE\n',
        'README.md': README,
        LICENSE,
        'guide.md': 'Project documentation.\n',
    });
    commitAll(sandbox.path);
    expect(readGitOutput(sandbox.path, ['check-ignore', 'README.md', 'LICENSE'])).toBe('README.md\nLICENSE');
    expect(await readFile(join(sandbox.path, 'README.md'), 'utf8')).toBe(README);
    expect(await readFile(join(sandbox.path, 'LICENSE'), 'utf8')).toBe(LICENSE);

    const found = await checkFindings(sandbox.path, 'docs/required-files');
    expect(found.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: 'README.md', rule: 'missing-readme', message: 'The scope root has no README.md.' },
        { file: 'LICENSE', rule: 'missing-license', message: 'The root has no LICENSE file.' },
    ]);

    await writeFile(join(sandbox.path, '.gitignore'), '');
    expect(await checkFindings(sandbox.path, 'docs/required-files')).toStrictEqual([]);
});
