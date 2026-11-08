import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import type { Finding } from '#cli/types/engine/tool-runs.ts';
import {
    JSX_COMMENTS,
    LIMIT_SUPPRESSION_CASES,
    QUOTED_ESLINT_COMMENTS,
    SUPPRESSION_SYNTAX_CASES,
} from '#tests/config/configurations/gspot/suppressions.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

describe.each([...SUPPRESSION_SYNTAX_CASES])(
    'suppression comments match $name',
    ({ configuration, extension, form, rows, body }) => {
        const sources = rows.map(([comment, active], index) => ({
            comment,
            active,
            path: `source-${index.toString()}.${extension}`,
            source: `${comment}\n${body}\n`,
        }));
        const resources = new AsyncDisposableStack();
        let comments: readonly Finding[];
        beforeAll(async () => {
            const sandbox = resources.use(await createGitSandbox({}));
            await createFileTree(sandbox.path, {
                'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
                ...Object.fromEntries(sources.map(({ path, source }) => [path, source])),
            });
            comments = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
        });
        afterAll(async () => {
            await resources.disposeAsync();
        });
        test.each([...sources])('$comment is a suppression: $active', ({ active, path }) => {
            expect(
                comments.filter((comment) => comment.file === path).map(({ line, rule }) => ({ line, rule })),
            ).toStrictEqual(active ? [{ line: 1, rule: `${form}-no-reason` }] : []);
        });
    },
);

test('eslint comments inside strings and templates are not suppressions', async () => {
    await using sandbox = await createGitSandbox({});
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript', 'structure'], { level: 'all' }),
        'source.ts': QUOTED_ESLINT_COMMENTS,
    });
    const comments = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(comments.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 1, rule: 'eslint-no-reason' },
        { line: 9, rule: 'eslint-no-reason' },
        { line: 10, rule: 'eslint-no-reason' },
    ]);
});

test('eslint comments in JSX text and quoted attributes are not directives; an empty expression comment is', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'structure'], { level: 'all' }),
        'source.tsx': JSX_COMMENTS,
    });

    const comments = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(comments.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 3, rule: 'eslint-no-reason' },
        { line: 5, rule: 'eslint-no-reason' },
    ]);
});

test.each([...LIMIT_SUPPRESSION_CASES])(
    '$configuration refuses a suppression of $name',
    async ({ configuration, file, directive, code, rule }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
            [file]: `${directive}\n${code}\n`,
        });
        const found = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
        expect(found.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([{ file, line: 1, rule }]);
    },
);
