import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { generateFile } from '#tests/setup/cli/config-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { EDITORCONFIG_SELECTOR_ERRORS } from '#tests/data/generation/config-files/builders/editorconfig.ts';

test.each([...EDITORCONFIG_SELECTOR_ERRORS])(
    'a format override selector that EditorConfig cannot express is a settings error ($pattern)',
    ({ pattern, message }) => {
        const format = { override: [{ paths: [pattern], indent_width: 2 }] };
        expect(
            generateFile(
                buildSandboxSettings(['javascript'], { rules: true, tables: stringify({ format }) }),
                'eslint.config.mjs',
                { 'app/source.js': 'export {};\n' },
            ),
        ).rejects.toThrow(matchFields<GspotError>({ name: 'GspotError', code: 'settings', message }));
    },
);
