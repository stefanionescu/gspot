import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { MARKDOWN_FENCE_CASES } from '#tests/data/checks/markdown.ts';

test.each([...MARKDOWN_FENCE_CASES])(
    'markdown/fences reports each fence that does not parse: $name',
    async ({ markdown, lines }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['markdown'], { level: 'all' }),
            'example.md': markdown,
        });
        const found = await checkFindings(sandbox.path, 'markdown/fences', { paths: ['example.md'] });
        expect(found.map(({ line, rule }) => [line, rule])).toStrictEqual(lines.map((line) => [line, 'syntax']));
    },
);
