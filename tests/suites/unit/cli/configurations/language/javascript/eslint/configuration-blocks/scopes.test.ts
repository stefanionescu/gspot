import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import {
    MATCHING_SCOPE_FILES,
    MATCHING_SCOPE_SETTINGS,
} from '#tests/config/configurations/javascript/configuration-blocks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import type { EslintConfiguration } from '#tests/types/setup.ts';

test("a parent's configuration block covers a matching nested scope, and a different scope keeps its test paths", async () => {
    await using sandbox = await testdir({
        ...MATCHING_SCOPE_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all', tables: MATCHING_SCOPE_SETTINGS }),
    });

    const eslint = await buildEslint(sandbox.path);
    const same = (await eslint.calculateConfigForFile('same/sample.test.ts')) as EslintConfiguration;
    const different = (await eslint.calculateConfigForFile('different/custom/sample.ts')) as EslintConfiguration;
    const code = (await eslint.calculateConfigForFile('different/src/sample.ts')) as EslintConfiguration;
    expect(same.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(0);
    expect(different.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(0);
    expect(code.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(2);
});
