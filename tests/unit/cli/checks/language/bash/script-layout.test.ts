import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runBashSamples } from '#tests/setup/fixes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { SCOPE_READER_FILES, SCRIPT_LAYOUT_CASES, SCOPE_READER_SETTINGS } from '#tests/config/bash/script-layout.ts';

runBashSamples(SCRIPT_LAYOUT_CASES);

test('script-layout permits top-level commands in an environment reader declared only by its scope', async () => {
    await using sandbox = await testdir({
        ...SCOPE_READER_FILES,
        'gspot.toml': settingsText(['bash'], { level: 'all', tables: SCOPE_READER_SETTINGS }),
    });
    expect(await checkFindings(sandbox.path, 'bash/script-layout', { scope: 'tools' })).toStrictEqual([]);
});
