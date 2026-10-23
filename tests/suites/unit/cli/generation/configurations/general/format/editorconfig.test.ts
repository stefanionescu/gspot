import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { generateFile } from '#tests/setup/cli/config-files.ts';
import { captureRejectedError } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { EDITORCONFIG_SELECTOR_ERRORS } from '#tests/config/generation/configurations/general/format.ts';

test.each([...EDITORCONFIG_SELECTOR_ERRORS])(
    'a format override selector that EditorConfig cannot express is a settings error ($pattern)',
    async ({ pattern, message }) => {
        const format = { override: [{ paths: [pattern], indent_width: 2 }] };
        const error = await captureRejectedError(
            generateFile(
                buildSandboxSettings(['javascript'], { rules: true, tables: stringify({ format }) }),
                'eslint.config.mjs',
                { 'app/source.js': 'export {};\n' },
            ),
        );
        expect(error).toMatchObject({ name: 'GspotError', code: 'settings', message });
    },
);
