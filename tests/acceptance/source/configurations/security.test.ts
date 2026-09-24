import { reportSchema } from '#cli/output/schema.ts';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the security configuration: an eval the shipped pack finds, and a rule of the repository's own.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'typescript',
    'security',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const CLEAN = 'export function double(value: number): number {\n    return value * 2;\n}\n';
const EVALUATED =
    'export function run(code: string): unknown {\n    // eslint-disable-next-line no-eval -- planted\n    return eval(code);\n}\n';
const OWN_RULE =
    'rules:\n    - id: planted-no-double\n      pattern: double(...)\n      message: The planted rule of the repository fires here.\n      languages: [typescript]\n      severity: ERROR\n';

describe('the security configuration', () => {
    test(
        'the shipped pack finds an eval, a repository rule runs beside it, and CodeQL waits to be asked',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'src/index.ts': CLEAN,
                'package.json': '{\n    "name": "planted",\n    "private": true\n}\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['semgrep', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const clean = await run(
                sandbox.path,
                ['check', '--only', 'security/semgrep', '--no-cache', '--json'],
                environment,
            );
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            await Bun.write(join(sandbox.path, 'src/run.ts'), EVALUATED);
            commitAll(sandbox.path);
            const found = await run(
                sandbox.path,
                ['check', '--only', 'security/semgrep', '--no-cache', '--json'],
                environment,
            );
            if (process.platform === 'win32') {
                expect(found.code, found.stdout + found.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(found.stdout)).checks).toMatchObject([
                    { check: 'security/semgrep', status: 'skipped' },
                ]);
            } else {
                expect(found.code, found.stdout + found.stderr).toBe(1);
                expect(reportSchema.parse(JSON.parse(found.stdout)).checks).toMatchObject([
                    {
                        check: 'security/semgrep',
                        status: 'fail',
                        findings: [expect.objectContaining({ rule: 'node-no-eval', file: 'src/run.ts', line: 3 })],
                    },
                ]);
            }
            await Bun.write(join(sandbox.path, 'security/own.yml'), OWN_RULE);
            await Bun.write(
                join(sandbox.path, 'src/use.ts'),
                "import { double } from './index.ts';\n\nexport const four = double(2);\n",
            );
            const policy = join(sandbox.path, 'gspot.toml');
            await Bun.write(
                policy,
                `${await Bun.file(policy).text()}\n[tools.semgrep]\nrules = ["security/own.yml"]\n`,
            );
            commitAll(sandbox.path);
            const own = await run(
                sandbox.path,
                ['check', '--only', 'security/semgrep', '--no-cache', '--json'],
                environment,
            );
            if (process.platform === 'win32') {
                expect(own.code, own.stdout + own.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(own.stdout)).checks).toMatchObject([
                    { check: 'security/semgrep', status: 'skipped' },
                ]);
            } else {
                expect(own.code, own.stdout + own.stderr).toBe(1);
                const report = reportSchema.parse(JSON.parse(own.stdout));
                expect(report.checks).toMatchObject([{ check: 'security/semgrep', status: 'fail' }]);
                expect(report.checks[0]!.findings).toContainEqual(
                    expect.objectContaining({ rule: 'planted-no-double', file: 'src/use.ts', line: 3 }),
                );
                await Bun.write(join(sandbox.path, 'src/run.ts'), CLEAN);
                await Bun.write(join(sandbox.path, 'src/use.ts'), 'export const four = 4;\n');
                const corrected = await run(
                    sandbox.path,
                    ['check', '--only', 'security/semgrep', '--no-cache', '--json'],
                    environment,
                );
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                    { check: 'security/semgrep', status: 'ok', findings: [] },
                ]);
            }
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
});
