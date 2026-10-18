import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { checkSuppressions } from '#cli/checks/gspot/suppressions.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { parseComments, stripCommentEnd } from '#cli/parsers/comments.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';
import { SUPPRESSION_DIRECTIVE_MESSAGES } from '#cli/config/checks/general/gspot.ts';
import { LIMIT_SUPPRESSION_CASES } from '#tests/data/checks/gspot/suppression-limits.ts';

import {
    JSX_COMMENTS,
    ESLINT_SUPPRESSIONS,
    QUOTED_ESLINT_COMMENTS,
    STYLELINT_SUPPRESSIONS,
    HTML_VALIDATE_SUPPRESSIONS,
} from '#tests/data/checks/gspot/suppressions.ts';

describe.each([
    {
        name: 'ESLint',
        configuration: 'javascript',
        extension: 'js',
        form: 'eslint',
        rows: ESLINT_SUPPRESSIONS,
        body: 'console.log(1);',
    },
    {
        name: 'Stylelint',
        configuration: 'css',
        extension: 'css',
        form: 'stylelint',
        rows: STYLELINT_SUPPRESSIONS,
        body: 'a { color: #ggg; }',
    },
    {
        name: 'HTML Validate',
        configuration: 'html',
        extension: 'html',
        form: 'html-validate',
        rows: HTML_VALIDATE_SUPPRESSIONS,
        body: '\u003Cimg src="sample.png">',
    },
])('suppression comments match $name', ({ configuration, extension, form, rows, body }) => {
    const sources = rows.map(([comment, active], index) => ({
        comment,
        active,
        path: `source-${index.toString()}.${extension}`,
        source: `${comment}\n${body}\n`,
    }));
    let sandbox: Awaited<ReturnType<typeof testdir>>;
    let comments: Awaited<ReturnType<typeof checkSuppressions>>;
    beforeAll(async () => {
        sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText([configuration], { level: 'all' }),
            ...Object.fromEntries(sources.map(({ path, source }) => [path, source])),
        });
        const session = await openSession(sandbox.path);
        comments = await checkSuppressions(buildCheckInput(session, 'gspot/suppressions'));
    });
    afterAll(async () => {
        await sandbox[Symbol.asyncDispose]();
    });
    test.each([...sources])('recognizes $comment', ({ active, path }) => {
        expect(comments.filter((entry) => entry.file === path).map(({ line, rule }) => ({ line, rule }))).toStrictEqual(
            active ? [{ line: 1, rule: `${form}-no-reason` }] : [],
        );
    });
});

test.each(['js', 'ts'])(
    'eslint comments inside strings and templates in .%s files are not directives',
    async (extension) => {
        await using sandbox = await testdir();
        const path = `source.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['typescript', 'structure'], { level: 'all' }),
            [path]: QUOTED_ESLINT_COMMENTS,
        });
        const session = await openSession(sandbox.path);
        const comments = await checkSuppressions(buildCheckInput(session, 'gspot/suppressions'));
        expect(comments.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
            { line: 1, rule: 'eslint-no-reason' },
            { line: 9, rule: 'eslint-no-reason' },
            { line: 10, rule: 'eslint-no-reason' },
        ]);
        const parsed = await parseComments(path, await Bun.file(`${sandbox.path}/${path}`).text());
        expect(
            parsed.flatMap(({ text, line }) =>
                /^(?:\/\/|#|--|<!--) ?marker:/u.test(stripCommentEnd(text)) ? [line] : [],
            ),
        ).toStrictEqual([12]);
    },
);

test('eslint comments in JSX text and quoted attributes are not directives; an empty expression comment is', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript', 'structure'], { level: 'all' }),
        'source.tsx': JSX_COMMENTS,
    });
    const session = await openSession(sandbox.path);
    const comments = await checkSuppressions(buildCheckInput(session, 'gspot/suppressions'));
    expect(comments.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 3, rule: 'eslint-no-reason' },
        { line: 5, rule: 'eslint-no-reason' },
    ]);
});

test.each([...LIMIT_SUPPRESSION_CASES])(
    '$configuration refuses suppression of $name',
    async ({ configuration, file, source, rule }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText([configuration], { level: 'all' }),
            [file]: source,
        });
        expect(await checkFindings(sandbox.path, 'gspot/suppressions')).toContainEqual(
            matchFields({
                file,
                rule,
                message: SUPPRESSION_DIRECTIVE_MESSAGES[rule.endsWith('-all') ? 'all' : 'limit'],
            }),
        );
    },
);
