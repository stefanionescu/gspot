import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { UNUSED_NAME_CASES } from '#tests/data/checks/naming/settings.ts';

test.each([...UNUSED_NAME_CASES])(
    'naming/allowed-names reports allowances unused by identifiers or paths: $name',
    async ({ files, settings, unusedNames }) => {
        await using sandbox = await testdir();
        const text = stringify({ level: 'all', ...settings });
        await createFileTree(sandbox.path, { ...files, 'gspot.toml': text });
        const findings = await checkFindings(sandbox.path, 'naming/allowed-names');
        expect(findings).toHaveLength(unusedNames.length);
        for (const [index, name] of unusedNames.entries()) {
            expect(findings[index]).toMatchObject({
                file: 'gspot.toml',
                rule: 'unused-record',
                message: matchSubstring(`"${name}"`),
            });
        }
    },
);
