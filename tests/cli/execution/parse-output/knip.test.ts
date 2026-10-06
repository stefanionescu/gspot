import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/platform/errors.ts';
import { parseOutput } from '#cli/parsers/output/parse.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { KNIP_REPORT, KNIP_EXPECTED, INVALID_KNIP_REPORTS } from '#tests/config/cli/execution/parse-output/knip.ts';

const check = configurationManifests()
    .get('javascript')!
    .checks.find(({ name }) => name === 'javascript/knip')!;

test('the declared Knip check retains every native category, grouped symbol and position', async () => {
    await using sandbox = await testdir();
    const findings = parseOutput(check, JSON.stringify(KNIP_REPORT), '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toStrictEqual(
        KNIP_EXPECTED.map((entry) => ({
            ...entry,
            check: check.name,
            file: 'space name.ts',
            help: check.help,
            fixable: false,
        })),
    );
    expect(parseOutput(check, '{"issues":[]}', '', { root: sandbox.path, cwd: sandbox.path })).toStrictEqual([]);
});

test.each(INVALID_KNIP_REPORTS)('the declared Knip check rejects invalid structured output %s', async (stdout) => {
    await using sandbox = await testdir();
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(GspotError);
});
