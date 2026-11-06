import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import {
    COVERAGE_CHECK_TABLES,
    DOC_FENCE_PATH_CASES,
    DOC_TASK_FILES,
    DOC_TASK_FINDINGS,
    DOC_TASK_SCOPES,
    IGNORED_PATH_FILES,
    MALFORMED_TASK_FILES,
    MDX_GUIDE,
    MDX_MISSING_PATH_FINDINGS,
    MISE_TASK_SOURCES,
    RELATIVE_PATH_FILES,
    RELATIVE_PATH_FINDINGS,
} from '#tests/config/configurations/docs.ts';
import { getBuiltInCheck, planSandboxCheck, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('Bun file commands validate tracked paths without treating them as package scripts', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        'guide.md': 'Run `bun run scripts/build.ts` and `bun run scripts/missing.ts`.\n',
        'scripts/build.ts': 'console.info("built");\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'docs/missing-paths');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'guide.md',
            line: 1,
            rule: 'missing-path',
            message: expect.stringContaining('scripts/missing.ts') as string,
        },
    ]);
});

async function runMissingPathsCheck(
    files: Record<string, string>,
    options: { paths?: string[] } = {},
): Promise<readonly Finding[]> {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        ...files,
    });
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
        { file: 'a.md', line: 2, rule: 'missing-path', message: expect.stringContaining('src/missing.ts') as string },
        { file: 'a.md', line: 2, rule: 'missing-path', message: expect.stringContaining('src/absent.ts') as string },
        { file: 'a.md', line: 2, rule: 'missing-path', message: expect.stringContaining('src/gone.ts') as string },
    ]);
});

test('missing-paths: leaves inline link targets to lychee, and checks prose, code spans, and reference definitions', async () => {
    const found = await runMissingPathsCheck(
        {
            'a.md': 'See [the guide](docs/missing.md "Guide"), ![logo](<img/missing logo.png>), and docs/gone.md.\nWrite `[the guide](docs/code.md)`.\n\n[guide]: docs/absent.md\n',
        },
        { paths: ['a.md'] },
    );
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 1, rule: 'missing-path', message: expect.stringContaining('docs/gone.md') as string },
        { file: 'a.md', line: 2, rule: 'missing-path', message: expect.stringContaining('docs/code.md') as string },
        { file: 'a.md', line: 4, rule: 'missing-path', message: expect.stringContaining('docs/absent.md') as string },
    ]);
});

test('missing-paths: gitignored paths and paths inside ignored folders count as present; others are reported', async () => {
    const found = await runMissingPathsCheck(IGNORED_PATH_FILES, { paths: ['a.md'] });
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'a.md', line: 2, rule: 'missing-path', message: expect.stringContaining('app/private.ts') as string },
        { file: 'a.md', line: 2, rule: 'missing-path', message: expect.stringContaining('src/gone.ts') as string },
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
        { file: 'a.md', line: 1, rule: 'missing-path', message: expect.stringContaining('tests/missing') as string },
    ]);
});

test.each([...MISE_TASK_SOURCES])(
    'missing-paths: $name count, and an unknown task is reported',
    async ({ tasks, files }) => {
        const named = [...tasks, 'absent'].map((task) => '`mise run ' + task + '`').join(', ');
        const found = await runMissingPathsCheck({ 'a.md': `Run ${named}.\n`, ...files }, { paths: ['a.md'] });
        expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
            {
                file: 'a.md',
                line: 1,
                rule: 'missing-task',
                message: expect.stringContaining('mise run absent') as string,
            },
        ]);
    },
);

test('missing-paths: clone host names are skipped while missing repository paths are reported', async () => {
    const found = await runMissingPathsCheck({
        'README.md': 'Clone github.com/example/demo.git and read docs/guide.md.\n',
    });
    expect(found.map(({ message }) => message)).toStrictEqual([expect.stringContaining('docs/guide.md') as string]);
});

test('missing-paths: paths relative to the document are found, and missing ones nearby are still reported', async () => {
    const found = await runMissingPathsCheck(RELATIVE_PATH_FILES, { paths: ['docs/guide.md'] });
    expect(found.map(({ line, message: description }) => [line, description])).toStrictEqual([
        ...RELATIVE_PATH_FINDINGS,
    ]);
});

test.each([...MALFORMED_TASK_FILES])(
    'missing-paths: a malformed $path is a read error, not a missing task',
    async ({ path, text, document, scopes, files }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['docs'], { level: 'all', scopes }),
            ...files,
        });

        const session = await openSession(sandbox.path);
        await writeFile(join(sandbox.path, path), text);
        session.cache = createRunCache(sandbox.path);
        const input = planSandboxCheck(session, 'docs/missing-paths', { paths: [document] });
        const failure = await captureRejection(getBuiltInCheck('docs/missing-paths')(session, input));
        expect(failure).toMatchObject({ name: 'GspotError', code: 'parse' });
        expect(failure.message).toContain(path);
    },
);

test('missing-paths: documented tasks are checked against their task tool and the nearest scope that defines them', async () => {
    const found = await runMissingPathsCheck({
        'gspot.toml': buildSandboxSettings([], { level: 'basic', scopes: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    expect(found.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        ...DOC_TASK_FINDINGS,
    ]);
});

test('missing-paths: a document in a child scope does not read unrelated or shadowed package scripts', async () => {
    const document = 'app/nested/guide.md';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: DOC_TASK_SCOPES }),
        ...Object.fromEntries(
            Object.entries(DOC_TASK_FILES).filter(([path]) => !path.endsWith('.md') || path === document),
        ),
    });

    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, { 'package.json': '{broken', 'sibling/package.json': '{broken' });
    session.cache = createRunCache(sandbox.path);

    expect(
        await getBuiltInCheck('docs/missing-paths')(session, planSandboxCheck(session, 'docs/missing-paths')),
    ).toStrictEqual([]);
});

test.each([...DOC_FENCE_PATH_CASES])(
    'missing-paths: a $language fence with the info "$info" reports example paths: $reported',
    async ({ info, language, reported }) => {
        const pathFindings = await runMissingPathsCheck(
            {
                'guide.md': `> ~~~${language} ${info}\n> cat src/example.ts\n> ~~~\n\nSee src/missing.ts.\n`,
            },
            { paths: ['guide.md'] },
        );
        expect(pathFindings.map(({ line, message }) => [line, message])).toStrictEqual([
            ...(reported ? [[2, expect.stringContaining('src/example.ts') as string]] : []),
            [5, expect.stringContaining('src/missing.ts') as string],
        ]);
    },
);

test('missing-paths: a generator output named by a setting counts as present before it is generated', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs', 'openapi'], {
            level: 'all',
            tables: '[openapi]\ndocument = "generated/openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n',
        }),
        'README.md': 'Read `generated/openapi.json` and `generated/missing.d.ts`.\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'docs/missing-paths', { paths: ['README.md'] })).toStrictEqual([
        expect.objectContaining({
            file: 'README.md',
            line: 1,
            rule: 'missing-path',
            message: expect.stringContaining('generated/missing.d.ts') as string,
        }),
    ]);
});

test.each(['CHANGELOG.md', 'docs/HISTORY.md'])(
    'missing-paths leaves %s out, because it names files that are gone',
    async (path) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
            [path]: '# Notes\n\nThis release removed `src/gone.ts`.\n',
        });
        expect(await runSandboxCheck(sandbox.path, 'docs/missing-paths')).toStrictEqual([]);
    },
);
