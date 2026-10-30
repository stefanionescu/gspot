import { parse } from 'jsonc-parser';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

test.each([...LEVELS])('%s turns on MD041 and MD025 only at level all and keeps your MD044 names', async (level) => {
    const content = await buildGeneratedFile(
        buildSandboxSettings(['markdown'], {
            level,
            tables: `[tools.markdownlint.rules.MD044]
names = ["Widget"]
`,
        }),
        getManifestTarget('markdown', 'markdownlint.jsonc'),
        { 'source.md': '# Widget\n' },
    );
    const config = parse(content) as Record<string, unknown>;
    expect(config['MD041']).toBe(level === 'all');
    expect(config['MD025']).toStrictEqual(level === 'all' ? { front_matter_title: '' } : false);
    expect(config['MD044']).toStrictEqual({ names: ['Widget'] });
});
