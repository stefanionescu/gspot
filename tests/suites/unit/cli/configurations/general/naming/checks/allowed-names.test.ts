import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { UNUSED_NAME_CASES } from '#tests/config/configurations/naming/validation.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...UNUSED_NAME_CASES])(
    'naming/allowed-names reports allowed names that no identifier or path uses: $name',
    async ({ files, settings, unused }) => {
        await using sandbox = await createGitSandbox({
            ...files,
            'gspot.toml': stringify({ level: 'all', ...settings }),
        });
        const findings = await runSandboxCheck(sandbox.path, 'naming/allowed-names');
        expect(
            findings.map(({ file, rule, message }) => {
                const [, record, name] = /record (\d+) allowed_names includes "([^"]+)"/u.exec(message) ?? [];
                return { file, rule, record: Number(record), name };
            }),
        ).toStrictEqual(unused.map(([record, name]) => ({ file: 'gspot.toml', rule: 'unused-record', record, name })));
    },
);
