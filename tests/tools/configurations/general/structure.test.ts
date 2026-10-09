import { basename } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { parseAlerts } from '#cli/parsers/output/contracts.ts';
import { suppressionComments } from '#cli/checks/general/structure/public.ts';
import { RUFF_DIRECTIVES, VALE_DIRECTIVES } from '#tests/config/tools/configurations/general/structure.ts';

test('suppression detection agrees with Ruff on every directive form and placement', async () => {
    await using sandbox = await testdir();
    const paths = RUFF_DIRECTIVES.map((_, index) => `source_${String(index)}.py`);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        ...Object.fromEntries(RUFF_DIRECTIVES.map(({ source }, index) => [paths[index]!, source])),
    });
    const native = await runTestCommand(
        ['ruff', 'check', '--isolated', '--select', 'F401', '--output-format', 'json', ...paths],
        { cwd: sandbox.path, env: { PATH: buildToolsPath(['ruff']) } },
    );
    expect(native.code, native.stdout + native.stderr).toBe(1);
    const reported = new Set(
        (JSON.parse(native.stdout) as Record<'filename', string>[]).map(({ filename }) => basename(filename)),
    );
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    expect(
        paths.map((path) => ({
            path,
            suppressed: !reported.has(path),
            directives: comments.filter((comment) => comment.file === path).map(({ line, form }) => ({ line, form })),
        })),
    ).toStrictEqual(
        RUFF_DIRECTIVES.map(({ suppressed, directive }, index) => ({
            path: paths[index]!,
            suppressed,
            directives: directive ? [{ line: 1, form: 'ruff' }] : [],
        })),
    );
});

test('shared suppression detection preserves Vale directives while excluding documented examples', async () => {
    await using sandbox = await testdir();
    const documents = VALE_DIRECTIVES.flatMap((entry, index) =>
        ['md', 'mdx'].map((extension) => ({ ...entry, path: `guide-${String(index)}.${extension}` })),
    );
    const paths = documents.map(({ path }) => path);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['prose']),
        '.vale.ini': 'StylesPath = styles\n[formats]\nmdx = md\n[*]\nBasedOnStyles = Example\n',
        'styles/Example/Concrete.yml': 'extends: existence\nmessage: "Use inspect."\nlevel: error\ntokens: [delve]\n',
        ...Object.fromEntries(
            documents.map(({ source, path }) => [path, `# Guide\n\n${source}\n\nWe delve into records.\n`]),
        ),
    });
    const native = await runTestCommand(['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', ...paths], {
        cwd: sandbox.path,
        env: { PATH: buildToolsPath(['vale']) },
    });
    expect(native.code, native.stdout + native.stderr).toBe(0);
    const reported = new Set(parseAlerts(native.stdout).map(({ file }) => basename(file)));
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    expect(
        paths.map((path) => ({
            path,
            suppressed: !reported.has(path),
            directives: comments
                .filter((comment) => comment.file === path)
                .map(({ line, form, forbidden }) => ({ line, form, forbidden })),
        })),
    ).toStrictEqual(
        documents.map(({ suppressed, directive, path }) => ({
            path,
            suppressed,
            directives: directive ? [{ line: 3, form: 'vale', forbidden: true }] : [],
        })),
    );
});
