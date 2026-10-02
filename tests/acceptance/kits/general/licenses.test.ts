// Planted repository for the licenses configuration: a package under a license outside the list, and an exception
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { toolsPath, installAtLevel } from '#tests/harness/tools/install.ts';

const LICENSES_INIT = [
    'init',
    '--yes',
    '--kits',
    'licenses',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];

const ROOT = '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true\n}\n';

const NPM_BIN = join(import.meta.dir, '../../../node_modules/.bin');

/** Creates installed license metadata and selects the package license check. */
async function prepareLicenseProject(root: string): Promise<{ PATH: string }> {
    await createFileTree(root, {
        'package.json': ROOT,
        '.gitignore': 'node_modules/\n',
        'node_modules/kind/package.json': JSON.stringify({ name: 'kind', version: '1.0.0', license: 'MIT' }),
        'node_modules/choice/package.json': JSON.stringify({
            name: 'choice',
            version: '1.0.0',
            license: 'MIT OR (GPL-3.0-only AND GPL-2.0-only)',
        }),
        'node_modules/combined/package.json': JSON.stringify({
            name: 'combined',
            version: '1.0.0',
            license: 'MIT AND (Apache-2.0 OR GPL-3.0-only)',
        }),
    });
    commitAll(root);
    const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['typos', 'ec'])}` };
    await installAtLevel(root, LICENSES_INIT, environment);
    return environment;
}

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
        const baseline = await spawnGspot(root, LICENSE_CHECK, environment);
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
            const applied = await spawnGspot(root, ['apply'], environment);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const checked = await spawnGspot(root, LICENSE_CHECK, environment);
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
