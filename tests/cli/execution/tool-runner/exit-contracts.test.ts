import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { TYPO } from '#tests/config/harness/spelling.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { getCheckRunner } from '#cli/execution/engines.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { runCommandCheck } from '#cli/execution/command/runner.ts';
import { statSync, chmodSync, existsSync, writeFileSync } from 'node:fs';
import { TYPO_REPORT, MARKDOWN_REPORT } from '#tests/config/cli/execution/parse-output/formats.ts';

test.each(['{file}', '{files}'])(
    'declared findings exits distinguish partial reports from fatal %s execution',
    async (placeholder) => {
        await using sandbox = await testdir();
        const source = 'input.txt';
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: [],
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
        const plans = planRun(session, { stage: 'all', skips: [], only: ['project/exit-contract'] });
        const planned = plans[0]!;
        planned.tool = { name: process.execPath, installers: {}, kind: 'binary' };
        const finding = await runCommandCheck(session, planned);
        expect(finding.status).toBe('failed');
        expect(finding.findings).toStrictEqual([
            containing({ file: source, line: 1, message: 'Located defect before exit' }),
        ]);
        writeFileSync(join(sandbox.path, source), '7');
        const fatal = await runCommandCheck(session, planned);
        expect(fatal.status).toBe('error');
        expect(fatal.findings).toStrictEqual([]);
        expect(fatal.note).toContain('exit 7');
        expect(await Bun.file(join(sandbox.path, source)).text()).toBe('7');
        writeFileSync(join(sandbox.path, source), '0');
        const corrected = await runCommandCheck(session, planned);
        expect(corrected.status).toBe('passed');
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
            'gspot.toml': buildPolicy(['actions']),
            '.github/workflows/caller.yml': workflow,
            actionlint: `#!${process.execPath}\nif (process.argv.includes('--version')) console.log('1.7.12'); else { await Bun.write(${JSON.stringify(record)}, process.cwd()); if (${String(code)} !== 0) console.log('.github/workflows/caller.yml:4:11: located defect [workflow-call]'); process.exitCode = ${String(code)}; }\n`,
        });
        chmodSync(executable, 0o755);
        chmodSync(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'commit', skips: [], only: ['actions/actionlint'] });
        const planned = plans[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await getCheckRunner(planned.spec, CHECKS)(session, planned);
        expect(result.status, JSON.stringify(result)).toBe(({ 0: 'passed', 1: 'failed', 3: 'error' } as const)[code]);
        const workspace = await Bun.file(record).text();
        expect(workspace).not.toBe(sandbox.path);
        expect(existsSync(workspace)).toBe(false);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        expect(statSync(join(sandbox.path, '.github/workflows/caller.yml')).mode & 0o777).toBe(getKeptMode(0o444));
        expect(existsSync(join(sandbox.path, '.git'))).toBe(false);
        // An exit outside the contract is an error that names the exit code and carries no findings.
        expect(result.note?.includes('exit 3') ?? false).toBe(code === 3);
        expect(result.findings.length > 0).toBe(code === 1);
    },
);

test.each(['typos', 'markdownlint'] as const)(
    'declared %s exits govern checks and corrections independently of the output parser',
    async (format) => {
        await using sandbox = await testdir();
        const path = format === 'typos' ? 'sample.txt' : 'sample.md';
        const source = format === 'typos' ? `${TYPO.the}\n` : '<span>Content</span>\n';
        const accepted = format === 'typos' ? 1 : 2;
        const native = format === 'typos' ? 2 : 1;
        const output = format === 'typos' ? TYPO_REPORT : [MARKDOWN_REPORT];
        const command = [process.execPath, 'checker.cjs', '{files}'];
        const policy = stringify({
            configurations: [],
            check: [
                {
                    name: 'project/native-exit',
                    command,
                    fix: [...command, '--fix'],
                    paths: [path],
                    stage: 'commit',
                    exit_codes: [accepted],
                    output: { format },
                },
            ],
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            [path]: source,
            'neighbor.txt': 'Keep this authored file.\n',
            'status.txt': String(accepted),
            'checker.cjs': `const fs = require("node:fs"); const code = !process.argv.includes("--fix") && fs.existsSync("check-passes") ? 0 : Number(fs.readFileSync("status.txt", "utf8")); if (code !== 0) console.log(${JSON.stringify(JSON.stringify(output))}); else if (${JSON.stringify(format)} === "markdownlint") console.log("[]"); process.exitCode = code;`,
        });
        const checkArguments = ['check', '--only', 'project/native-exit', '--fix', '--json'];
        const partial = await runGspot(sandbox.path, checkArguments);
        expect(partial.code, partial.stdout + partial.stderr).toBe(1);
        expect(JSON.parse(partial.stdout) as RunReport).toMatchObject({
            failed: ['project/native-exit'],
            checks: [{ check: 'project/native-exit', status: 'failed', findings: [{ file: path, line: 1 }] }],
        });
        writeFileSync(join(sandbox.path, 'status.txt'), String(native));
        const fatal = await runGspot(sandbox.path, checkArguments);
        expect(fatal.code, fatal.stdout + fatal.stderr).toBe(2);
        expect(JSON.parse(fatal.stdout) as RunReport).toMatchObject({
            failed: ['project/native-exit'],
            checks: [{ status: 'error', findings: [] }],
        });
        await Bun.write(join(sandbox.path, 'check-passes'), '');
        const failedFix = await runGspot(sandbox.path, checkArguments);
        expect(failedFix.code, failedFix.stdout + failedFix.stderr).toBe(2);
        expect(JSON.parse(failedFix.stdout) as RunReport).toMatchObject({
            failed: ['project/native-exit'],
            checks: [{ status: 'passed', findings: [] }],
        });
        writeFileSync(join(sandbox.path, 'status.txt'), '0');
        const corrected = await runGspot(sandbox.path, checkArguments);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
        expect(
            await Promise.all(
                [path, 'gspot.toml', 'neighbor.txt'].map((file) => Bun.file(join(sandbox.path, file)).text()),
            ),
        ).toStrictEqual([source, policy, 'Keep this authored file.\n']);
    },
);
