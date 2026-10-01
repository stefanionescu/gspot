// Planted repository for the licenses configuration: a package under a license outside the list, and an exception
// that goes stale.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { prepareLicenseProject } from '#tests/support/cli/licenses.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';

const LICENSE_CHECK = ['check', '--only', 'licenses/packages', '--json'];
// The license the installed strict package reports, the exception the policy grants, and the finding that results.
const STEPS = [
    { license: 'GPL-3.0-only', exception: undefined, finding: 'strict@1.0.0 reports GPL-3.0-only' },
    { license: 'GPL-3.0-only', exception: 'GPL-3.0-only', finding: undefined },
    { license: 'GPL-3.0-only', exception: 'LGPL-3.0-only', finding: 'the exception no longer holds' },
    { license: 'MIT', exception: 'LGPL-3.0-only', finding: 'strict@1.0.0 reports MIT' },
    { license: 'MIT', exception: 'MIT', finding: undefined },
];

test(
    'package licenses accept allowed alternatives and exact exceptions, and a stale exception fails until corrected',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const environment = await prepareLicenseProject(root);
        const baseline = await run(root, LICENSE_CHECK, environment);
        expect(baseline.code, baseline.stdout + baseline.stderr).toBe(0);
        const policy = join(root, 'gspot.toml');
        const before = await Bun.file(policy).text();
        for (const { license, exception, finding } of STEPS) {
            await Bun.write(
                join(root, 'node_modules/strict/package.json'),
                JSON.stringify({ name: 'strict', version: '1.0.0', license }),
            );
            await Bun.write(
                policy,
                exception === undefined
                    ? before
                    : `${before}\n[[tools.licenses.packages_allowed]]\npackage = "strict@1.0.0"\nlicense = "${exception}"\nreason = "Used at build time only, never shipped."\n`,
            );
            const applied = await run(root, ['apply'], environment);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const checked = await run(root, LICENSE_CHECK, environment);
            expect(checked.code, `${license} ${String(exception)}: ${checked.stdout}`).toBe(
                finding === undefined ? 0 : 1,
            );
            expect((JSON.parse(checked.stdout) as RunReport).checks[0]?.findings).toStrictEqual(
                finding === undefined
                    ? []
                    : [containing({ file: 'package.json', rule: 'license', message: textContaining(finding) })],
            );
        }
    },
    PLANTED_TIMEOUT_MS * 4,
);
