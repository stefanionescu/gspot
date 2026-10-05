import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { commentText, parseComments } from '#cli/parsers/comments.ts';
import { suppressionComments } from '#cli/checks/general/structure/suppressions.ts';

// The lines of the comments in a source that open with the marker; a marker inside a string or a block value is no comment.
async function markedLines(path: string, source: string): Promise<number[]> {
    const comments = await parseComments(path, source);
    return comments
        .filter((comment) => /^(?:\/\/|#|--|<!--) ?marker:/u.test(commentText(comment.text)))
        .map((comment) => comment.line);
}

test.each(['js', 'ts', 'mts', 'cts', 'tsx'])(
    'suppression comments in %s distinguish strings and templates from executable directives',
    async (extension) => {
        await using sandbox = await testdir();
        const path = `source.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript', 'structure'], { level: 'all' }),
            [path]: [
                String.raw`const apostrophe = "I am Sid\'s example"; // eslint-disable-line no-console`,
                'const template = `',
                '// eslint-disable-next-line no-alert',
                '// marker: Fixture text is not a directive.',
                '`;',
                'const ordinary = "// marker: This is fixture text.";',
                '// eslint-disable-next-line no-alert -- reason: External callback owns this call.',
                'alert(ordinary);',
                'function empty() { /* eslint-disable no-console */ }',
                'const nested = `${(() => { // eslint-disable-line no-alert',
                'return 1; })()}`;',
                '// marker: Required external interface.',
                'const active = 1;',
            ].join('\n'),
        });
        const session = await openSession(sandbox.path);
        const comments = await suppressionComments(
            session.root,
            session.scopes,
            session.reads,
            session.repository.files,
        );
        expect(comments.map(({ line, form, reason }) => ({ line, form, reason }))).toStrictEqual([
            { line: 1, form: 'eslint', reason: undefined },
            { line: 7, form: 'eslint', reason: 'reason: External callback owns this call.' },
            { line: 9, form: 'eslint', reason: undefined },
            { line: 10, form: 'eslint', reason: undefined },
        ]);
        expect(await markedLines(path, await Bun.file(`${sandbox.path}/${path}`).text())).toStrictEqual([12]);
    },
);

test('JSX text and quoted attributes do not become directives, but an empty expression comment does', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'structure'], { level: 'all' }),
        'source.tsx': [
            'const element = <div title="// eslint-disable no-alert">',
            '// eslint-disable no-console',
            '{/* eslint-disable no-debugger */}',
            '</div>;',
            '// eslint-disable-next-line no-alert',
            'alert(element);',
        ].join('\n'),
    });
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual([
        { line: 3, form: 'eslint' },
        { line: 5, form: 'eslint' },
    ]);
});

test('a shell comment after a quoted apostrophe stays a comment while quoted marker text stays literal', async () => {
    const source =
        'echo "Sid\'s value" # marker: Required external interface.\necho "# marker: Literal fixture text."\n';
    expect(await markedLines('source.sh', source)).toStrictEqual([1]);
});

test.each(["'", "E'", '"'])('an unterminated SQL %s value hides the comment text after it', async (opener) => {
    const source = [
        '-- marker: Required interface.',
        `SELECT ${opener}`,
        '-- marker: Literal fixture text.',
        ':value;',
    ];
    expect(await markedLines('source.sql', source.join('\n'))).toStrictEqual([1]);
});

test.each([
    [
        'source.toml',
        'value = """\n# marker: Literal fixture text.\n"""\n# marker: Required interface.\nactual = 1\n',
        4,
    ],
    [
        'source.toml',
        "value = '''\n# marker: Literal fixture text.\n'''\n# marker: Required interface.\nactual = 1\n",
        4,
    ],
    [
        'source.sql',
        'select $body$\n-- marker: Literal fixture text.\n$body$;\n-- marker: Required interface.\nselect 1;\n',
        4,
    ],
    ['source.sql', "select '\n-- marker: Literal fixture text.\n';\n-- marker: Required interface.\nselect 1;\n", 4],
    [
        'source.pgsql',
        '/* Example directive:\n-- marker: Literal fixture text.\n*/\n-- marker: Required interface.\nselect 1;\n',
        4,
    ],
    ['source.psql', '\\echo -- marker: Literal fixture text.\n-- marker: Required interface.\nselect 1;\n', 2],
    [
        'source.md',
        '```html\n<!-- marker: Literal fixture text. -->\n```\n<!-- marker: Required interface. -->\nText.\n',
        4,
    ],
    ['source.md', '`<!-- marker: Literal fixture text. -->`\n<!-- marker: Required interface. -->\nText.\n', 2],
    ['source.md', 'Example 😀\n\n<!-- marker: Required interface. -->\nText.\n', 3],
    ['source.yaml', 'value: |\n  # marker: Literal fixture text.\n# marker: Required interface.\nactual: 1\n', 3],
    ['source.yml', 'value: >-\n  # marker: Literal fixture text.\n# marker: Required interface.\nactual: 1\n', 3],
    ['source.yaml', 'value: "\n  # marker: Literal fixture text.\n  "\n# marker: Required interface.\nactual: 1\n', 4],
    ['source.py', 'value = """\n# marker: Literal fixture text.\n"""\n# marker: Required interface.\nvalue = 1\n', 4],
    ['source.sh', 'cat <<EOF\n# marker: Literal fixture text.\nEOF\n# marker: Required interface.\nvalue=1\n', 4],
    [
        'source.swift',
        'let value = """\n// marker: Literal fixture text.\n"""\n// marker: Required interface.\nlet actual = 1\n',
        4,
    ],
    [
        'source.html',
        '<script>\nconst value = "<!-- marker: Literal fixture text. -->";\n</script>\n<!-- marker: Required interface. -->\n<div></div>\n',
        4,
    ],
] as const)('multiline source values in %s do not become comments', async (path, source, line) => {
    expect(await markedLines(path, source)).toStrictEqual([line]);
});
