import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { MARKDOWN_FENCE_CASES } from '#tests/config/configurations/language.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
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

test('options for a rule that the formatter owns are refused', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], {
            tables: stringify({ tools: { markdownlint: { rules: { MD009: { br_spaces: 2 } } } } }),
        }),
    });
    const session = await openSession(sandbox.path);
    expect(() => buildGeneratedFiles(session)).toThrow(expect.objectContaining({ code: 'settings' }));
});

test('a selected configuration turns off its markdownlint rules', async () => {
    const target = getManifestTarget('markdown', 'markdownlint.jsonc');
    const rules = (readConfigurations().get('mkdocs')?.markdownlint.rules_off ?? []).flatMap((entry) => entry.rules);
    const selected = JSON.parse(
        await buildGeneratedFile(buildSandboxSettings(['markdown', 'mkdocs']), target, {}),
    ) as Record<string, unknown>;
    const alone = JSON.parse(await buildGeneratedFile(buildSandboxSettings(['markdown']), target, {})) as Record<
        string,
        unknown
    >;
    expect(rules.map((rule) => [rule, selected[rule]])).toStrictEqual(rules.map((rule) => [rule, false]));
    expect(rules.filter((rule) => alone[rule] === false)).toStrictEqual([]);
});
