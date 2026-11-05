import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { parse } from 'jsonc-parser';

import { MARKDOWNLINT_PRETTIER_DISABLED, MARKDOWNLINT_RULES } from '#cli/config/configurations/language.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { compareText } from '#cli/system/text.ts';
import { MARKDOWN_FENCE_CASES } from '#tests/config/configurations/language.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
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

test('gspot leaves off the rules that the markdownlint prettier style turns off, except the rules gspot turns on', async () => {
    const cli = await realpath(join(toolModules, 'markdownlint-cli2', 'package.json'));
    const markdownlint = dirname(dirname(createRequire(cli).resolve('markdownlint')));
    const { default: rules } = (await import(pathToFileURL(join(markdownlint, 'lib/rules.mjs')).href)) as {
        default: Array<{ names: string[] }>;
    };
    const style = JSON.parse(await readFile(join(markdownlint, 'style/prettier.json'), 'utf8')) as Record<
        string,
        unknown
    >;
    const ids = new Map(rules.flatMap(({ names }) => names.map((name) => [name.toLowerCase(), names[0]])));
    const enabled = new Set(
        Object.entries(MARKDOWNLINT_RULES).flatMap(([rule, value]) => (value === false ? [] : [rule])),
    );
    const styleOff = Object.keys(style).flatMap((name) => {
        const rule = ids.get(name);
        return rule === undefined ? [] : [rule];
    });
    const leftOff: string[] = [...MARKDOWNLINT_PRETTIER_DISABLED];
    expect(leftOff).toStrictEqual(styleOff.filter((rule) => !enabled.has(rule)).toSorted(compareText));
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
