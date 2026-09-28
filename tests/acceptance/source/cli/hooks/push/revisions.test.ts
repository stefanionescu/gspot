// The pre-push hook checks exactly the pushed objects and leaves the working tree alone.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { expect, test } from 'bun:test';
import { git } from '#tests/support/cli/git.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import type { SarifReport } from '#tests/types/cli.ts';
import { pushReportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/cli.ts';
import { preparePushRepository } from '#tests/support/cli/push.ts';
import { gspot, run, runProcess } from '#tests/support/cli/command.ts';

test(
    'pre-push checks exact supplied objects despite conflicting working-tree repairs',
    async () => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
        const passing = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/reviewed ${base}\n`,
        });
        expect(passing.code, passing.stdout + passing.stderr).toBe(0);
        const first = pushReportSchema.parse(JSON.parse(passing.stdout)).revisions;
        expect(first).toHaveLength(1);
        const firstReport = first[0]!.report;
        expect(firstReport.comparison).toStrictEqual({ content: 'commit', reference: reviewed });
        expect(firstReport.checks[0]?.status).toBe('ok');
        expect(firstReport.checks[0]?.files).toBe(1);
        const failing = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n`,
        });
        expect(failing.code, failing.stdout + failing.stderr).toBe(1);
        expect(
            pushReportSchema
                .parse(JSON.parse(failing.stdout))
                .revisions[0]!.report.checks[0]?.findings.map((finding) => finding.file),
        ).toStrictEqual(['changed.sh', 'changed.sh']);
        expect({
            head: git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim(),
            policy: readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'),
            source: readFileSync(join(sandbox.path, 'changed.sh'), 'utf8'),
        }).toStrictEqual({
            head: broken,
            policy: 'invalid working policy',
            source: 'echo repaired only in the working tree\n',
        });
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'pre-push text supplies an executable reproduction of the same committed findings',
    async () => {
        await using sandbox = await testdir();
        const { base, broken, command } = await preparePushRepository(sandbox.path);
        const failing = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n`,
        });
        const pushText = await runProcess(
            command.filter((argument) => argument !== '--json'),
            {
                cwd: sandbox.path,
                env: { GSPOT_HOOK: 'pre-push' },
                stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n`,
            },
        );
        expect(pushText.code, pushText.stdout + pushText.stderr).toBe(1);
        expect(pushText.stdout).toContain('reproduce: printf');
        expect(pushText.stdout).toContain('Bypass this hook once: git push --no-verify');
        const failedReport = pushReportSchema.parse(JSON.parse(failing.stdout)).revisions[0]!.report;
        const reproduction = failedReport.checks[0]?.reproduce;
        expect(reproduction).toBeDefined();
        const repeated = await runProcess(
            [
                'bash',
                '-c',
                'runtime=$1; cli=$2; gspot() { "$runtime" "$cli" "$@"; }; eval "$3"',
                'reproduce',
                process.execPath,
                gspot,
                reproduction!.replace('gspot check', 'gspot check --json'),
            ],
            { cwd: sandbox.path },
        );
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
        const repeatedReport = pushReportSchema.parse(JSON.parse(repeated.stdout));
        expect(repeatedReport.revisions[0]?.object).toBe(broken);
        expect(repeatedReport.revisions[0]?.report.checks[0]?.findings).toStrictEqual(failedReport.checks[0]?.findings);
        expect({
            head: git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim(),
            policy: readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'),
            source: readFileSync(join(sandbox.path, 'changed.sh'), 'utf8'),
        }).toStrictEqual({
            head: broken,
            policy: 'invalid working policy',
            source: 'echo repaired only in the working tree\n',
        });
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'pre-push reports multiple objects once per object and handles forced rewinds',
    async () => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, command } = await preparePushRepository(sandbox.path);
        const multiple = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/broken ${broken} refs/heads/one ${base}\nrefs/heads/reviewed ${reviewed} refs/heads/two ${base}\n`,
        });
        expect(multiple.code, multiple.stdout + multiple.stderr).toBe(1);
        const saved = pushReportSchema.parse(
            JSON.parse(readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8')),
        );
        expect(saved).toStrictEqual(pushReportSchema.parse(JSON.parse(multiple.stdout)));
        expect(saved.revisions.map((revision) => revision.report.exitCode)).toStrictEqual([1, 0]);
        const sarif = JSON.parse(
            readFileSync(join(sandbox.path, '.gspot/reports/report.sarif'), 'utf8'),
        ) as SarifReport;
        expect(sarif.runs).toHaveLength(2);
        expect(sarif.runs.map((entry) => entry.properties?.comparison?.reference)).toStrictEqual([broken, reviewed]);
        expect(sarif.runs[0]!.results).toHaveLength(2);
        expect(sarif.runs[1]!.results).toHaveLength(0);
        const duplicated = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/one ${base}\nrefs/heads/also-reviewed ${reviewed} refs/heads/two ${base}\n`,
        });
        expect(duplicated.code, duplicated.stdout + duplicated.stderr).toBe(0);
        const merged = pushReportSchema.parse(JSON.parse(duplicated.stdout));
        expect(merged.revisions).toHaveLength(1);
        expect(merged.revisions[0]!.refs).toHaveLength(2);
        const forced = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/rewound ${base} refs/heads/main ${broken}\n`,
        });
        expect(forced.code, forced.stdout + forced.stderr).toBe(0);
        expect(pushReportSchema.parse(JSON.parse(forced.stdout)).revisions[0]!.report.checks[0]?.files).toBe(1);
        expect({
            head: git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim(),
            policy: readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'),
            source: readFileSync(join(sandbox.path, 'changed.sh'), 'utf8'),
        }).toStrictEqual({
            head: broken,
            policy: 'invalid working policy',
            source: 'echo repaired only in the working tree\n',
        });
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'full-tree pre-push policy checks unchanged files in the pushed object',
    async () => {
        await using sandbox = await testdir();
        const { broken, command } = await preparePushRepository(sandbox.path);
        writeFileSync(
            join(sandbox.path, 'gspot.toml'),
            'version = 1\nconfigurations = ["bash"]\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        );
        const configured = await run(sandbox.path, ['set', 'hooks.push', 'all']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        expect(git(sandbox.path, ['add', 'gspot.toml', 'changed.sh']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'full pushed tree']).code).toBe(0);
        const pushedCommit = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        const all = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${pushedCommit} refs/heads/main ${broken}\n`,
        });
        expect(all.code, all.stdout + all.stderr).toBe(1);
        expect(
            pushReportSchema
                .parse(JSON.parse(all.stdout))
                .revisions[0]?.report.checks[0]?.findings.map((finding) => finding.file),
        ).toStrictEqual(['legacy.sh', 'legacy.sh']);
    },
    PLANTED_TIMEOUT_MS,
);
