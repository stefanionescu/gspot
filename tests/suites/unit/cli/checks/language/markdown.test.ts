import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { MARKDOWN_FENCE_CASES } from '#tests/config/checks/language/markdown.ts';

test.each([...MARKDOWN_FENCE_CASES])(
    'markdown/fences reports each fence that does not parse: $name',
    async ({ markdown, lines }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['markdown'], { level: 'all' }),
            'example.md': markdown,
        });
        const found = await runSandboxCheck(sandbox.path, 'markdown/fences', { paths: ['example.md'] });
        expect(found.map(({ line, rule }) => [line, rule])).toStrictEqual(lines.map((line) => [line, 'syntax']));
    },
);

test('a broken fence in MDX reports its source line', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'guide.mdx': 'import Panel from "./Panel.jsx";\n\n# Guide\n\n<Panel />\n\n```json\n{broken\n```\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'markdown/fences');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'guide.mdx', line: 8, rule: 'syntax' },
    ]);
});
