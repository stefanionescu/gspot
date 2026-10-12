import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import { MISSING_SECTIONS_README } from '#tests/config/docs.ts';

async function readmeShapeFindings(
    files: Record<string, string>,
    options: { paths?: string[] } = {},
): Promise<readonly Finding[]> {
    await using sandbox = await testdir({ 'gspot.toml': settingsText(['docs'], { level: 'all' }), ...files });
    return await checkFindings(sandbox.path, 'docs/readme-shape', options);
}

test('a README with one H1, an opening paragraph and a setup section passes', async () => {
    expect(
        await readmeShapeFindings(
            { 'README.md': '# Thing\n\nWhat it is.\n\n## Setup\n\nRun it.\n' },
            { paths: ['README.md'] },
        ),
    ).toStrictEqual([]);
});

test('a README missing the pieces names each one', async () => {
    const found = await readmeShapeFindings({ 'README.md': MISSING_SECTIONS_README }, { paths: ['README.md'] });
    expect(found.map((finding) => finding.rule)).toStrictEqual(['opening-paragraph', 'start-section']);
});

test('a list before the setup section does not count as an opening paragraph', async () => {
    const found = await readmeShapeFindings(
        { 'README.md': '# Thing\n\n- An item.\n\n## Setup\n' },
        { paths: ['README.md'] },
    );
    expect(found.map((finding) => finding.rule)).toStrictEqual(['opening-paragraph']);
});
