import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SKIP_REASON_CASES } from '#tests/config/checks/language/swift/skip-reasons.ts';

test.each([...SKIP_REASON_CASES])(
    'swift/skip-reasons checks the reason argument of `$body`',
    async ({ body, missing }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift']),
            'Examples/Checks.swift': `import Testing\nfunc checks() throws {\n    ${body}\n}\n`,
        });

        const findings = await runSandboxCheck(sandbox.path, 'swift/skip-reasons');
        expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual(
            missing ? [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }] : [],
        );
    },
);
