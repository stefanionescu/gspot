import { expect, test } from 'bun:test';

import { parseSettings } from '#cli/settings/parse.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('naming cases equal to the shipped default need no reason, and other cases do', () => {
    const text = buildSandboxSettings(['typescript'], { tables: '[naming.typescript.files]\n cases = ["kebab"]\n' });
    parseSettings(text, process.cwd());
    expect(() => parseSettings(text.replace('["kebab"]', '["camel"]'), process.cwd())).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: expect.stringContaining('gspot.toml:3: naming.typescript.files.cases.reason') as string,
        }),
    );
});
