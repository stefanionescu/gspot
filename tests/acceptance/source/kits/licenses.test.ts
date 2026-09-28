// Planted repository for the licenses configuration: a package under a license outside the list, and an exception that went stale.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rmSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { run, runProcess } from '#tests/support/cli/command.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import { prepareLicenseProject } from '#tests/support/cli/licenses.ts';
import { containingAll, textContaining } from '#tests/support/expectations.ts';

const LICENSE_CHECK = ['check', '--only', 'licenses/packages', '--no-cache', '--json'];
test(
    'package license expressions accept allowed alternatives and reject forbidden requirements',
    async () => {
        await using sandbox = await testdir();
        const environment = await prepareLicenseProject(sandbox.path);
        const baseline = await run(sandbox.path, LICENSE_CHECK, environment);
        expect(baseline.code, baseline.stdout + baseline.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(baseline.stdout)).checks).toMatchObject([
            { check: 'licenses/packages', status: 'ok', findings: [] },
        ]);
        for (const license of ['GPL-3.0-only', '(MIT OR Apache-2.0) AND GPL-3.0-only']) {
            await Bun.write(
                join(sandbox.path, 'node_modules/strict/package.json'),
                `{\n    "name": "strict",\n    "version": "1.0.0",\n    "license": "${license}"\n}\n`,
            );
            const refused = await run(sandbox.path, LICENSE_CHECK, environment);
            expect(refused.code, refused.stdout + refused.stderr).toBe(1);
            expect(reportSchema.parse(JSON.parse(refused.stdout)).checks).toMatchObject([
                {
                    check: 'licenses/packages',
                    status: 'fail',
                    findings: [
                        {
                            file: 'package.json',
                            rule: 'license',
                            line: 1,
                            message: textContaining(`strict@1.0.0 reports ${license}`),
                        },
                    ],
                },
            ]);
        }
    },
    PLANTED_TIMEOUT_MS * 2,
);

test(
    'package allowances require the exact reported license and reject a mismatched exception',
    async () => {
        await using sandbox = await testdir();
        const environment = await prepareLicenseProject(sandbox.path);
        await Bun.write(
            join(sandbox.path, 'node_modules/strict/package.json'),
            `{\n    "name": "strict",\n    "version": "1.0.0",\n    "license": "GPL-3.0-only"\n}\n`,
        );
        const policy = join(sandbox.path, 'gspot.toml');
        const before = await Bun.file(policy).text();
        await Bun.write(
            policy,
            `${before}\n[[tools.licenses.packages_allowed]]\npackage = "strict@1.0.0"\nlicense = "GPL-3.0-only"\nreason = "Used at build time only, never shipped."\n`,
        );
        const appliedGpl = await run(sandbox.path, ['apply'], environment);
        expect(appliedGpl.code).toBe(0);
        const gplAllowance = await run(sandbox.path, LICENSE_CHECK, environment);
        expect(gplAllowance.code, gplAllowance.stdout + gplAllowance.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(gplAllowance.stdout)).checks).toMatchObject([
            { check: 'licenses/packages', status: 'ok', findings: [] },
        ]);
        await Bun.write(
            policy,
            `${before}\n[[tools.licenses.packages_allowed]]\npackage = "strict@1.0.0"\nlicense = "LGPL-3.0-only"\nreason = "Used at build time only, never shipped."\n`,
        );
        const appliedLgpl = await run(sandbox.path, ['apply'], environment);
        expect(appliedLgpl.code).toBe(0);
        const stale = await run(sandbox.path, LICENSE_CHECK, environment);
        expect(stale.code).toBe(1);
        expect(reportSchema.parse(JSON.parse(stale.stdout)).checks).toMatchObject([
            {
                check: 'licenses/packages',
                status: 'fail',
                findings: [
                    {
                        file: 'package.json',
                        rule: 'license',
                        line: 1,
                        message: textContaining('the exception no longer holds'),
                    },
                ],
            },
        ]);
    },
    PLANTED_TIMEOUT_MS * 2,
);

test(
    'changed package metadata invalidates its allowance until the policy is corrected',
    async () => {
        await using sandbox = await testdir();
        const environment = await prepareLicenseProject(sandbox.path);
        await Bun.write(
            join(sandbox.path, 'node_modules/strict/package.json'),
            `{\n    "name": "strict",\n    "version": "1.0.0",\n    "license": "GPL-3.0-only"\n}\n`,
        );
        const policy = join(sandbox.path, 'gspot.toml');
        const before = await Bun.file(policy).text();
        await Bun.write(
            policy,
            `${before}\n[[tools.licenses.packages_allowed]]\npackage = "strict@1.0.0"\nlicense = "LGPL-3.0-only"\nreason = "Used at build time only, never shipped."\n`,
        );
        const applied = await run(sandbox.path, ['apply'], environment);
        expect(applied.code).toBe(0);
        await Bun.write(
            join(sandbox.path, 'node_modules/strict/package.json'),
            `{\n    "name": "strict",\n    "version": "1.0.0",\n    "license": "MIT"\n}\n`,
        );
        const changedToAllowed = await run(sandbox.path, LICENSE_CHECK, environment);
        expect(changedToAllowed.code, changedToAllowed.stdout + changedToAllowed.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(changedToAllowed.stdout)).checks).toMatchObject([
            {
                check: 'licenses/packages',
                status: 'fail',
                findings: [
                    {
                        file: 'package.json',
                        rule: 'license',
                        line: 1,
                        message: textContaining('strict@1.0.0 reports MIT'),
                    },
                ],
            },
        ]);
        await Bun.write(
            policy,
            `${before}\n[[tools.licenses.packages_allowed]]\npackage = "strict@1.0.0"\nlicense = "MIT"\nreason = "Used at build time only, never shipped."\n`,
        );
        const appliedMIT = await run(sandbox.path, ['apply'], environment);
        expect(appliedMIT.code).toBe(0);
        const correctedLicense = await run(sandbox.path, LICENSE_CHECK, environment);
        expect(correctedLicense.code, correctedLicense.stdout + correctedLicense.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(correctedLicense.stdout)).checks).toMatchObject([
            { check: 'licenses/packages', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 2,
);

test.each(['recommended', 'all'])(
    'Python license policy generation preserves identical scoped settings at %s',
    async (level) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = []\n[rules]\ninstall = false\n[[scope]]\npath = "app"\nconfigurations = ["licenses"]\n[scope.tools.licenses]\nlicenses_allowed = ["MIT"]\n`,
            'app/pyproject.toml':
                '[project]\nname = "fixture"\nversion = "0.0.0"\n[tool.pip-licenses]\nignore-packages = ["licensed-example"]\n',
            'sibling/pyproject.toml': '[project]\nname = "uninstalled-sibling"\nversion = "0.0.0"\n',
        });
        const applied = await run(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const generatedPath = join(root, '.gspot/config/app/licenses.json');
        const generated = readFileSync(generatedPath);
        expect(JSON.parse(generated.toString('utf8'))).toMatchObject({
            licenses_allowed: containingAll(['MIT']),
            packages_allowed: [],
        });
        const reapplied = await run(root, ['apply']);
        expect(reapplied.code, reapplied.stdout + reapplied.stderr).toBe(0);
        expect(readFileSync(generatedPath)).toStrictEqual(generated);
    },
    PLANTED_TIMEOUT_MS,
);

test.each(['recommended', 'all'])(
    'Python license CLI at %s scans the selected scope and distinguishes unavailable environments',
    async (level) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = []\n[rules]\ninstall = false\n[[scope]]\npath = "app"\nconfigurations = ["licenses"]\n[scope.tools.licenses]\nlicenses_allowed = ["MIT"]\n`,
            'app/pyproject.toml':
                '[project]\nname = "fixture"\nversion = "0.0.0"\n[tool.pip-licenses]\nignore-packages = ["licensed-example"]\n',
            'sibling/pyproject.toml': '[project]\nname = "uninstalled-sibling"\nversion = "0.0.0"\n',
        });
        const applied = await run(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(root);
        const command = ['check', '--stage', 'push', '--only', 'licenses/packages', '--no-cache', '--json'];
        const unavailable = await run(root, command);
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        const created = await runProcess(['uv', 'venv', 'app/.venv'], { cwd: root });
        expect(created.code, created.stderr).toBe(0);
        const empty = await run(root, command);
        expect(empty.code, empty.stdout + empty.stderr).toBe(2);
        const python = join(root, 'app/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
        const located = await runProcess(
            [python, '-I', '-c', 'import sysconfig; print(sysconfig.get_path("purelib"))'],
            { cwd: root },
        );
        expect(located.code, located.stderr).toBe(0);
        const metadata = join(located.stdout.trim(), 'licensed_example-1.0.0.dist-info/METADATA');
        await Bun.write(
            metadata,
            `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: GPL-3.0-only\n`,
        );
        const rejected = await run(root, command);
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(rejected.stdout)).checks).toMatchObject([
            {
                check: 'licenses/packages',
                scope: 'app',
                status: 'fail',
                findings: [{ file: 'app/pyproject.toml', rule: 'license' }],
            },
        ]);
        await Bun.write(metadata, `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: MIT\n`);
        const corrected = await run(root, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: 'licenses/packages', status: 'ok', findings: [] },
        ]);
        rmSync(python);
        const broken = await run(root, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(2);
    },
    PLANTED_TIMEOUT_MS * 2,
);
