import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { UNUSED_NAME_CASES } from '#tests/config/checks/general/naming/allowed-names.ts';

test.each([...UNUSED_NAME_CASES])(
    'naming/allowed-names reports allowed names that no identifier or path uses: $name',
    async ({ files, settings, messages }) => {
        await using sandbox = await testdir({ ...files, 'gspot.toml': stringify({ level: 'all', ...settings }) });
        const findings = await runSandboxCheck(sandbox.path, 'naming/allowed-names');
        expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual(
            messages.map((message) => ({ file: 'gspot.toml', rule: 'unused-record', message })),
        );
    },
);
