import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { inlineIgnores } from '#cli/execution/ignores.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';

test.each(['js', 'ts', 'mts', 'cts', 'tsx'])(
    'suppression comments in %s distinguish strings and templates from executable directives',
    async (extension) => {
        await using sandbox = await testdir();
        const path = `source.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["typescript", "structure"]\n',
            [path]: [
                String.raw`const apostrophe = "I am Sid\'s example"; // eslint-disable-line no-console`,
                'const template = `',
                '// eslint-disable-next-line no-alert',
                '// gspot-ignore structure/custom -- Fixture text is not a directive.',
                '`;',
                'const ordinary = "// gspot-ignore structure/custom -- This is fixture text.";',
                '// eslint-disable-next-line no-alert -- reason: External callback owns this call.',
                'alert(ordinary);',
                'function empty() { /* eslint-disable no-console */ }',
                'const nested = `${(() => { // eslint-disable-line no-alert',
                'return 1; })()}`;',
                '// gspot-ignore structure/custom -- Required external interface.',
                'const active = 1;',
            ].join('\n'),
        });
        const session = await openSession(sandbox.path);
        const comments = await suppressionComments(
            session.root,
            session.scopes,
            session.observations,
            session.repository.files,
        );
        expect(comments.map(({ line, form, reason }) => ({ line, form, reason }))).toStrictEqual([
            { line: 1, form: 'eslint', reason: undefined },
            { line: 7, form: 'eslint', reason: 'reason: External callback owns this call.' },
            { line: 9, form: 'eslint', reason: undefined },
            { line: 10, form: 'eslint', reason: undefined },
            { line: 12, form: 'gspot-ignore', reason: 'Required external interface.' },
        ]);
        expect(await inlineIgnores(session.observations, path)).toStrictEqual([
            { line: 13, check: 'structure/custom', reason: 'Required external interface.' },
        ]);
    },
);

test('JSX text and quoted attributes do not become directives, but an empty expression comment does', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["typescript", "structure"]\n',
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
    const comments = await suppressionComments(
        session.root,
        session.scopes,
        session.observations,
        session.repository.files,
    );
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual([
        { line: 3, form: 'eslint' },
        { line: 5, form: 'eslint' },
    ]);
});

test('a shell ignore after a quoted apostrophe stays active while quoted directive text stays literal', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.sh':
            'echo "Sid\'s value" # gspot-ignore structure/custom -- Required external interface.\necho "# gspot-ignore structure/custom -- Literal fixture text."\n',
    });
    expect(await inlineIgnores({ root: sandbox.path, sources: new Map() }, 'source.sh')).toStrictEqual([
        { line: 1, check: 'structure/custom', reason: 'Required external interface.' },
    ]);
});

test.each(["'", "E'", '"'])('an unterminated SQL %s value cannot activate a suppression', async (opener) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.sql': [
            '-- gspot-ignore structure/custom -- Required interface.',
            `SELECT ${opener}`,
            '-- gspot-ignore structure/custom -- Literal fixture text.',
            ':value;',
        ].join('\n'),
    });
    expect(await inlineIgnores({ root: sandbox.path, sources: new Map() }, 'source.sql')).toStrictEqual([
        { line: 2, check: 'structure/custom', reason: 'Required interface.' },
    ]);
});

test.each([
    [
        'source.toml',
        'value = """\n# gspot-ignore structure/custom -- Literal fixture text.\n"""\n# gspot-ignore structure/custom -- Required interface.\nactual = 1\n',
        5,
    ],
    [
        'source.toml',
        "value = '''\n# gspot-ignore structure/custom -- Literal fixture text.\n'''\n# gspot-ignore structure/custom -- Required interface.\nactual = 1\n",
        5,
    ],
    [
        'source.rb',
        'value = <<TEXT\n# gspot-ignore structure/custom -- Literal fixture text.\nTEXT\n# gspot-ignore structure/custom -- Required interface.\nactual = 1\n',
        5,
    ],
    [
        'source.rb',
        'value = %q{\n# gspot-ignore structure/custom -- Literal fixture text.\n}\n# gspot-ignore structure/custom -- Required interface.\nactual = 1\n',
        5,
    ],
    [
        'source.sql',
        'select $body$\n-- gspot-ignore structure/custom -- Literal fixture text.\n$body$;\n-- gspot-ignore structure/custom -- Required interface.\nselect 1;\n',
        5,
    ],
    [
        'source.sql',
        "select '\n-- gspot-ignore structure/custom -- Literal fixture text.\n';\n-- gspot-ignore structure/custom -- Required interface.\nselect 1;\n",
        5,
    ],
    [
        'source.pgsql',
        '/* Example directive:\n-- gspot-ignore structure/custom -- Literal fixture text.\n*/\n-- gspot-ignore structure/custom -- Required interface.\nselect 1;\n',
        5,
    ],
    [
        'source.psql',
        '\\echo -- gspot-ignore structure/custom -- Literal fixture text.\n-- gspot-ignore structure/custom -- Required interface.\nselect 1;\n',
        3,
    ],
    [
        'source.md',
        '```html\n<!-- gspot-ignore structure/custom -- Literal fixture text. -->\n```\n<!-- gspot-ignore structure/custom -- Required interface. -->\nText.\n',
        5,
    ],
    [
        'source.md',
        '`<!-- gspot-ignore structure/custom -- Literal fixture text. -->`\n<!-- gspot-ignore structure/custom -- Required interface. -->\nText.\n',
        3,
    ],
    ['source.md', 'Example 😀\n\n<!-- gspot-ignore structure/custom -- Required interface. -->\nText.\n', 4],
    [
        'source.yaml',
        'value: |\n  # gspot-ignore structure/custom -- Literal fixture text.\n# gspot-ignore structure/custom -- Required interface.\nactual: 1\n',
        4,
    ],
    [
        'source.yml',
        'value: >-\n  # gspot-ignore structure/custom -- Literal fixture text.\n# gspot-ignore structure/custom -- Required interface.\nactual: 1\n',
        4,
    ],
    [
        'source.yaml',
        'value: "\n  # gspot-ignore structure/custom -- Literal fixture text.\n  "\n# gspot-ignore structure/custom -- Required interface.\nactual: 1\n',
        5,
    ],
    [
        'source.py',
        'value = """\n# gspot-ignore structure/custom -- Literal fixture text.\n"""\n# gspot-ignore structure/custom -- Required interface.\nvalue = 1\n',
        5,
    ],
    [
        'source.sh',
        'cat <<EOF\n# gspot-ignore structure/custom -- Literal fixture text.\nEOF\n# gspot-ignore structure/custom -- Required interface.\nvalue=1\n',
        5,
    ],
    [
        'source.swift',
        'let value = """\n// gspot-ignore structure/custom -- Literal fixture text.\n"""\n// gspot-ignore structure/custom -- Required interface.\nlet actual = 1\n',
        5,
    ],
    [
        'source.html',
        '<script>\nconst value = "<!-- gspot-ignore structure/custom -- Literal fixture text. -->";\n</script>\n<!-- gspot-ignore structure/custom -- Required interface. -->\n<div></div>\n',
        5,
    ],
] as const)('multiline source values in %s do not become inline ignores', async (path, source, line) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: source });
    expect(await inlineIgnores({ root: sandbox.path, sources: new Map() }, path)).toStrictEqual([
        { line, check: 'structure/custom', reason: 'Required interface.' },
    ]);
});
