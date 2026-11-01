import { test, expect } from 'bun:test';
import { readSettings } from '#cli/settings/read.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('naming cases equal to the shipped default need no reason, and other cases do', () => {
    const text = buildSandboxSettings(['typescript'], { tables: '[naming.typescript.files]\n cases = ["kebab"]\n' });
    readSettings(text, process.cwd());
    expect(() => readSettings(text.replace('["kebab"]', '["camel"]'), process.cwd())).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message:
                'gspot.toml:3: naming.typescript.files.cases.reason: naming.typescript.files.cases needs a reason. Write it as naming.typescript.files.cases = { value = [...], reason = "..." }, or run gspot set naming.typescript.files.cases ... --reason "<why>".',
        }),
    );
});
