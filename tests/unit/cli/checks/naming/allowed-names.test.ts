import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { UNUSED_NAME_CASES, ALLOWED_NAMES_CHECK_COMMAND } from '#tests/data/checks/naming/settings.ts';

test.each([...UNUSED_NAME_CASES])(
    'naming/allowed-names reports allowances unused by identifiers or paths: $name',
    async ({ files, settings, unusedNames }) => {
        await using sandbox = await testdir();
        const text = stringify({ level: 'all', ...settings });
        await createFileTree(sandbox.path, { ...files, 'gspot.toml': text });
        const result = await checkReport(sandbox.path, ALLOWED_NAMES_CHECK_COMMAND);
        expect(result.code, result.stdout + result.stderr).toBe(unusedNames.length === 0 ? 0 : 1);
        const findings = result.report.checks.flatMap(({ findings }) => findings);
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
