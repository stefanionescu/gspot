import { resolveCheck } from '#cli/execution/engines.ts';
import { planRun } from '#cli/execution/plan.ts';
import { openSession } from '#cli/execution/session.ts';
import { runToolCheck } from '#cli/execution/tool-runner.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

test.each(['{file}', '{files}'])(
    'declared findings exits distinguish partial reports from fatal %s execution',
    async (placeholder) => {
        await using sandbox = await testdir();
        const source = 'input.txt';
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                version: 1,
                configurations: [],
                check: [
                    {
                        name: 'project/exit-contract',
                        command: [process.execPath, 'checker.cjs', placeholder],
                        paths: [source],
                        stage: 'commit',
                        findings_exit_codes: [1],
                        output: { format: 'regex', pattern: '^(?<file>.+):(?<line>\\d+): (?<message>.+)$' },
                    },
                ],
            }),
            [source]: '1',
            'checker.cjs':
                'const fs = require("node:fs"); const file = process.argv[2]; const status = Number(fs.readFileSync(file, "utf8")); if (status !== 0) console.log(`${file}:1: Located defect before exit`); process.exitCode = status;',
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'all', skips: [] }))[0]!;
        planned.tool = { name: process.execPath, installers: {}, windows: true };
        const finding = await runToolCheck(session, planned);
        expect(finding.status).toBe('fail');
        expect(finding.findings).toStrictEqual([
            expect.objectContaining({ file: source, line: 1, message: 'Located defect before exit' }),
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

test.each([0, 1, 3])(
    'Actionlint removes its prepared project after adapter exit %i without changing source permissions',
    async (code) => {
        await using sandbox = await testdir();
        const record = join(sandbox.path, 'workspace.txt');
        const executable = join(sandbox.path, 'actionlint');
        const workflow = 'on: workflow_dispatch\njobs:\n  caller:\n    uses: $/.github/workflows/called.yml\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
            '.github/workflows/caller.yml': workflow,
            actionlint: `#!${process.execPath}\nif (process.argv.includes('--version')) console.log('1.7.12'); else { await Bun.write(${JSON.stringify(record)}, process.cwd()); if (${code} !== 0) console.log('.github/workflows/caller.yml:4:11: located defect [workflow-call]'); process.exitCode = ${code}; }\n`,
        });
        chmodSync(executable, 0o755);
        chmodSync(join(sandbox.path, '.github/workflows/caller.yml'), 0o444);
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        planned.tool = { ...planned.tool!, name: executable };
        const result = await resolveCheck(planned.spec)(session, planned);
        expect(result.status, JSON.stringify(result)).toBe(code === 0 ? 'ok' : code === 1 ? 'fail' : 'error');
        const workspace = await Bun.file(record).text();
        expect(workspace).not.toBe(sandbox.path);
        expect(existsSync(workspace)).toBe(false);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        expect(statSync(join(sandbox.path, '.github/workflows/caller.yml')).mode & 0o777).toBe(0o444);
        expect(existsSync(join(sandbox.path, '.git'))).toBe(false);
        if (code === 3) {
            expect(result.note).toContain('exit 3');
            expect(result.findings).toStrictEqual([]);
        }
    },
);
