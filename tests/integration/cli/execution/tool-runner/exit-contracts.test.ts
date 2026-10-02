import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkExecution } from '#cli/execution/engines.ts';
import { keptMode } from '#tests/harness/cli/platforms.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { statSync, chmodSync, existsSync, writeFileSync } from 'node:fs';

test.each(['{file}', '{files}'])(
    'declared findings exits distinguish partial reports from fatal %s execution',
    async (placeholder) => {
        await using sandbox = await testdir();
        const source = 'input.txt';
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                kits: [],
                check: [
                    {
                        name: 'project/exit-contract',
                        command: [process.execPath, 'checker.cjs', placeholder],
                        paths: [source],
                        stage: 'commit',
                        exit_codes: [1],
                        output: { format: 'regex', pattern: String.raw`^(?<file>.+):(?<line>\d+): (?<message>.+)$` },
                    },
                ],
            }),
            [source]: '1',
            'checker.cjs':
                'const fs = require("node:fs"); const file = process.argv[2]; const status = Number(fs.readFileSync(file, "utf8")); if (status !== 0) console.log(`${file}:1: Located defect before exit`); process.exitCode = status;',
        });
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'all', skips: [] });
        const planned = plans[0]!;
        planned.tool = { name: process.execPath, installers: {} };
        const finding = await runToolCheck(session, planned);
        expect(finding.status).toBe('fail');
        expect(finding.findings).toStrictEqual([
            containing({ file: source, line: 1, message: 'Located defect before exit' }),
        ]);
        writeFileSync(join(sandbox.path, source), '7');
        const fatal = await runToolCheck(session, planned);
        expect(fatal.status).toBe('error');
        expect(fatal.findings).toStrictEqual([]);
        expect(fatal.note).toContain('exit 7');
        expect(await Bun.file(join(sandbox.path, source)).text()).toBe('7');
        writeFileSync(join(sandbox.path, source), '0');
        const corrected = await runToolCheck(session, planned);
        expect(corrected.status).toBe('ok');
        expect(corrected.findings).toStrictEqual([]);
    },
);

test.each([0, 1, 3] as const)(
    'Actionlint removes its prepared project after adapter exit %i without changing source permissions',
    async (code) => {
        await using sandbox = await testdir();
        const record = join(sandbox.path, 'workspace.txt');
        const executable = join(sandbox.path, 'actionlint');
        const workflow = 'on: workflow_dispatch\njobs:\n  caller:\n    uses: $/.github/workflows/called.yml\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['files']),
            '.github/workflows/caller.yml': workflow,
            actionlint: `#!${process.execPath}\nif (process.argv.includes('--version')) console.log('1.7.12'); else { await Bun.write(${JSON.stringify(record)}, process.cwd()); if (${String(code)} !== 0) console.log('.github/workflows/caller.yml:4:11: located defect [workflow-call]'); process.exitCode = ${String(code)}; }\n`,
        });
        chmodSync(executable, 0o755);
        chmodSync(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'commit', skips: [], only: ['files/actions'] });
        const planned = plans[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await checkExecution(planned.spec, CHECKS)(session, planned);
        expect(result.status, JSON.stringify(result)).toBe(({ 0: 'ok', 1: 'fail', 3: 'error' } as const)[code]);
        const workspace = await Bun.file(record).text();
        expect(workspace).not.toBe(sandbox.path);
        expect(existsSync(workspace)).toBe(false);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        expect(statSync(join(sandbox.path, '.github/workflows/caller.yml')).mode & 0o777).toBe(keptMode(0o444));
        expect(existsSync(join(sandbox.path, '.git'))).toBe(false);
        // An exit outside the contract is an error that names the exit code and carries no findings.
        expect(result.note?.includes('exit 3') ?? false).toBe(code === 3);
        expect(result.findings.length > 0).toBe(code === 1);
    },
);
