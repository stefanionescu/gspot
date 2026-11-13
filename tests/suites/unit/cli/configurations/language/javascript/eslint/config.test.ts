import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { LINGUIST_GENERATED_PATTERN } from '#tests/config/configurations/general.ts';
import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import { captureRejection } from '#tests/setup/matchers.ts';

test('ESLint skips build output and files marked linguist-generated in .gitattributes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tests/build/check.js': 'missing();',
        'emitted/check.js': 'missing();',
        '.gitattributes': LINGUIST_GENERATED_PATTERN,
    });

    const eslint = await buildEslint(sandbox.path);
    for (const filePath of ['tests/build/check.js', 'emitted/check.js']) {
        expect(await eslint.isPathIgnored(filePath)).toBe(true);
    }
});

test('options for a rule that only level all runs stop the config at basic', async () => {
    const error = await captureRejection(
        buildGeneratedFile(
            buildSandboxSettings(['javascript'], {
                level: 'basic',
                tables: '[tools.eslint.rules]\n"no-nested-ternary" = []\n',
            }),
            getManifestTarget('javascript', 'eslint/eslint.mjs'),
            { 'package.json': '{"private":true,"type":"module"}\n' },
        ),
    );
    expect(error).toMatchObject({ code: 'settings' });
    expect(error.message).toContain('no-nested-ternary');
});
