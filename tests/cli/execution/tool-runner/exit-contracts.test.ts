import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { checkReport } from '#tests/harness/gspot.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { TYPO_REPORT, MARKDOWN_REPORT } from '#tests/config/cli/parsers/output/formats.ts';

test.each(['{file}', '{files}'])(
    'declared findings exits distinguish partial reports from fatal %s execution',
    async (placeholder) => {
        await using sandbox = await testdir();
        const source = 'input.txt';
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: [],
                check: {
                    'project/exit-contract': {
                        command: [process.execPath, 'checker.cjs', placeholder],
                        paths: [source],
                        stage: 'commit',
                        exit_codes: [1],
                        output: { format: 'regex', pattern: String.raw`^(?<file>.+):(?<line>\d+): (?<message>.+)$` },
                    },
                },
            }),
            [source]: '1',
            'checker.cjs':
                'const fs = require("node:fs"); const file = process.argv[2]; const status = Number(fs.readFileSync(file, "utf8")); if (status !== 0) console.log(`${file}:1: Located defect before exit`); process.exitCode = status;',
        });
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'all', skips: [], only: ['project/exit-contract'] });
        const planned = plans[0]!;
        planned.tool = { name: process.execPath, installers: {}, kind: 'binary' };
        const finding = await runCheckCommand(session, planned);
        expect(finding.status).toBe('failed');
        expect(finding.findings).toStrictEqual([
            containing({ file: source, line: 1, message: 'Located defect before exit' }),
        ]);
        await writeFile(join(sandbox.path, source), '7');
        const fatal = await runCheckCommand(session, planned);
        expect(fatal.status).toBe('error');
        expect(fatal.findings).toStrictEqual([]);
        expect(fatal.note).toContain('exit 7');
        expect(await Bun.file(join(sandbox.path, source)).text()).toBe('7');
        await writeFile(join(sandbox.path, source), '0');
        const corrected = await runCheckCommand(session, planned);
        expect(corrected.status).toBe('passed');
        expect(corrected.findings).toStrictEqual([]);
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
            check: {
                'project/native-exit': {
                    command,
                    fix: [...command, '--fix'],
                    paths: [path],
                    stage: 'commit',
                    exit_codes: [accepted],
                    output: { format },
                },
            },
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            [path]: source,
            'neighbor.txt': 'Keep this authored file.\n',
            'status.txt': String(accepted),
            'checker.cjs': `const fs = require("node:fs"); const code = !process.argv.includes("--fix") && fs.existsSync("check-passes") ? 0 : Number(fs.readFileSync("status.txt", "utf8")); if (code !== 0) console.log(${JSON.stringify(JSON.stringify(output))}); else if (${JSON.stringify(format)} === "markdownlint") console.log("[]"); process.exitCode = code;`,
        });
        const checkArguments = ['check', '--only', 'project/native-exit', '--fix', '--json'];
        const partial = await checkReport(sandbox.path, checkArguments);
        expect(partial.code, partial.stdout + partial.stderr).toBe(1);
        expect(partial.report).toMatchObject({
            failed: ['project/native-exit'],
            checks: [{ check: 'project/native-exit', status: 'failed', findings: [{ file: path, line: 1 }] }],
        });
        await writeFile(join(sandbox.path, 'status.txt'), String(native));
        const fatal = await checkReport(sandbox.path, checkArguments);
        expect(fatal.code, fatal.stdout + fatal.stderr).toBe(2);
        expect(fatal.report).toMatchObject({
            failed: ['project/native-exit'],
            checks: [{ status: 'error', findings: [] }],
        });
        await Bun.write(join(sandbox.path, 'check-passes'), '');
        const failedFix = await checkReport(sandbox.path, checkArguments);
        expect(failedFix.code, failedFix.stdout + failedFix.stderr).toBe(2);
        expect(failedFix.report).toMatchObject({
            failed: ['project/native-exit'],
            checks: [{ status: 'passed', findings: [] }],
        });
        await writeFile(join(sandbox.path, 'status.txt'), '0');
        const corrected = await checkReport(sandbox.path, checkArguments);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
        expect(
            await Promise.all(
                [path, 'gspot.toml', 'neighbor.txt'].map((file) => Bun.file(join(sandbox.path, file)).text()),
            ),
        ).toStrictEqual([source, policy, 'Keep this authored file.\n']);
    },
);
