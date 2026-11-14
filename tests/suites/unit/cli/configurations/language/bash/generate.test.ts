import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

test('shellcheckrc disables an ignored rule and enables nothing at basic', async () => {
    const text = await buildGeneratedFile(
        buildSandboxSettings(['bash'], {
            tables: '[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\nreason = "The words split on purpose."\n',
        }),
        getManifestTarget('bash', 'shellcheckrc'),
        {},
    );
    expect(text.split('\n').filter((line) => /^(?:disable|enable)=/u.test(line))).toStrictEqual([
        expect.stringMatching(/^disable=(?:.+,)?SC2086(?:,|$)/u) as string,
    ]);
});
