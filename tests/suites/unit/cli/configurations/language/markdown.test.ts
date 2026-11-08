import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { parse } from 'jsonc-parser';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { MARKDOWN_FENCE_CASES } from '#tests/config/configurations/language.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...MARKDOWN_FENCE_CASES])(
    'markdown/fences reports each fence that does not parse: $name',
    async ({ markdown, lines }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['markdown'], { level: 'all' }),
            'example.md': markdown,
        });
        const found = await runSandboxCheck(sandbox.path, 'markdown/fences', { paths: ['example.md'] });
        expect(found.map(({ line, rule }) => [line, rule])).toStrictEqual(lines.map((line) => [line, 'syntax']));
    },
);

test('a broken fence in MDX reports its source line', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'guide.mdx': 'import Panel from "./Panel.jsx";\n\n# Guide\n\n<Panel />\n\n```json\n{broken\n```\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'markdown/fences');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'guide.mdx', line: 8, rule: 'syntax' },
    ]);
});

test.each([
    { configurations: ['markdown'], expected: [{ style: 'fenced' }, undefined] },
    { configurations: ['markdown', 'mkdocs'], expected: [false, false] },
])('markdownlint turns MD046 and MD053 off only in a scope that selects mkdocs: $configurations', async (row) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(row.configurations) });
    const { files } = buildGeneratedFiles(await openSession(sandbox.path));
    const document = parse(files.find(({ path }) => path.endsWith('/markdownlint.jsonc'))!.content) as Record<
        string,
        unknown
    >;
    expect([document['MD046'], document['MD053']]).toStrictEqual([...row.expected]);
});

test('options for a rule that the formatter owns are refused', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], {
            tables: stringify({ tools: { markdownlint: { rules: { MD009: { br_spaces: 2 } } } } }),
        }),
    });
    const session = await openSession(sandbox.path);
    expect(() => buildGeneratedFiles(session)).toThrow(expect.objectContaining({ code: 'settings' }));
});
