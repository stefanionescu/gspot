import { parse } from 'jsonc-parser';
import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { generateFile, findManifestTarget } from '#tests/setup/cli/generated-files.ts';

test('Markdown refuses options for a rule disabled at the selected level', async () => {
    const generated = generateFile(
        buildSandboxSettings(['markdown'], { tables: '[tools.markdownlint.rules.MD013]\nline_length = 100\n' }),
        findManifestTarget('markdown', 'markdownlint.jsonc'),
        { 'source.md': '# Sample\n' },
    );
    expect(await captureRejection(generated)).toBe('gspot runs MD013 at no level, so it takes no options.');
});

test.each([...LEVELS])('%s turns on MD041 and MD025 only at level all and keeps your MD044 names', async (level) => {
    const content = await generateFile(
        buildSandboxSettings(['markdown'], {
            level,
            tables: `[tools.markdownlint.rules.MD044]
names = ["Widget"]
`,
        }),
        findManifestTarget('markdown', 'markdownlint.jsonc'),
        { 'source.md': '# Widget\n' },
    );
    const config = parse(content) as Record<string, unknown>;
    expect(config['MD041']).toBe(level === 'all');
    expect(config['MD025']).toStrictEqual(level === 'all' ? { front_matter_title: '' } : false);
    expect(config['MD044']).toStrictEqual({ names: ['Widget'] });
});
