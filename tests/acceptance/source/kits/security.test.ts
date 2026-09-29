// Planted repository for the security configuration: an eval the shipped pack finds, and a rule of the repository's own.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import type { Finding } from '#cli/types/checks.ts';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { toolsPath, installAtLevel } from '#tests/support/cli/tools.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';
import { SECURITY_INIT } from '#tests/config/acceptance/source/kits/init-arguments.ts';
import { OWN_RULE, EVALUATED, SECURITY_CLEAN } from '#tests/config/acceptance/source/kits/kits.ts';

test(
    'the security configuration > the shipped pack and repository rules reject defects and accept corrected files',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'src/index.ts': SECURITY_CLEAN,
            'package.json': '{\n    "name": "planted",\n    "private": true\n}\n',
        });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['semgrep', 'typos', 'ec']) };
        await installAtLevel(sandbox.path, SECURITY_INIT, environment);
        const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
        const clean = await run(sandbox.path, command, environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        await Bun.write(join(sandbox.path, 'src/run.ts'), EVALUATED);
        commitAll(sandbox.path);
        const found = await run(sandbox.path, command, environment);
        // Semgrep ships no Windows build, so the check is skipped there and the run passes.
        const isWindows = process.platform === 'win32';
        const evaluated: Finding = containing({ rule: 'node-no-eval', file: 'src/run.ts', line: 3 });
        expect(found.code, found.stdout + found.stderr).toBe(isWindows ? 0 : 1);
        expect(reportSchema.parse(JSON.parse(found.stdout)).checks).toMatchObject([
            isWindows
                ? { check: 'security/semgrep', status: 'skipped' }
                : { check: 'security/semgrep', status: 'fail', findings: [evaluated] },
        ]);
        await Bun.write(join(sandbox.path, 'security/own.yml'), OWN_RULE);
        await Bun.write(
            join(sandbox.path, 'src/use.ts'),
            "import { double } from './index.ts';\n\nexport const four = double(2);\n",
        );
        const policy = join(sandbox.path, 'gspot.toml');
        await Bun.write(policy, `${await Bun.file(policy).text()}\n[tools.semgrep]\nrules = ["security/own.yml"]\n`);
        commitAll(sandbox.path);
        const own = await run(sandbox.path, command, environment);
        expect(own.code, own.stdout + own.stderr).toBe(isWindows ? 0 : 1);
        const report = reportSchema.parse(JSON.parse(own.stdout));
        expect(report.checks).toMatchObject([{ check: 'security/semgrep', status: isWindows ? 'skipped' : 'fail' }]);
        expect(report.checks[0]!.findings).toStrictEqual(
            isWindows ? [] : containingAll([containing({ rule: 'planted-no-double', file: 'src/use.ts', line: 3 })]),
        );
        await Bun.write(join(sandbox.path, 'src/run.ts'), SECURITY_CLEAN);
        await Bun.write(join(sandbox.path, 'src/use.ts'), 'export const four = 4;\n');
        const corrected = await run(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: 'security/semgrep', status: isWindows ? 'skipped' : 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 3,
);

test(
    'the security push stage includes shipped rules and leaves external scans opt-in',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'src/index.ts': SECURITY_CLEAN,
            'package.json': '{\n    "name": "planted",\n    "private": true\n}\n',
        });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['semgrep', 'typos', 'ec']) };
        await installAtLevel(sandbox.path, SECURITY_INIT, environment);
        const checked = await run(sandbox.path, ['check', '--stage', 'push', '--json'], environment);
        const atPush = JSON.parse(checked.stdout) as {
            checks: { check: string }[];
        };
        const ids = atPush.checks.map((check) => check.check);
        expect(ids).toContain('security/semgrep');
        expect(ids).not.toContain('security/codeql');
        expect(ids).not.toContain('security/semgrep-registry');
    },
    PLANTED_TIMEOUT_MS * 3,
);
