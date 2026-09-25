import { delimiter, join } from 'node:path';
import { git } from '#tests/support/cli/git.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
// The hook gspot installs runs the staged checks on commit.
import { runProcess } from '#tests/support/cli/command.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { pushReportSchema, reportSchema } from '#cli/execution/report.ts';
import { gspot, PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

describe('the gspot hook', () => {
    test(
        'installed and freshly cloned repositories enforce staged defects through real commits',
        async () => {
            await using sandbox = await testdir();
            await using cloneRoot = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            git(sandbox.path, ['init', '-q']);
            git(sandbox.path, ['add', '-A']);
            git(sandbox.path, ['commit', '-qm', 'init']);
            await run(sandbox.path, [
                'init',
                '--yes',
                '--configurations',
                'bash',
                '--without',
                'formatting',
                '--no-runner',
                '--no-ci',
                '--no-rules',
                '--no-install',
            ]);
            const installed = await run(sandbox.path, ['install']);
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            await Bun.write(join(sandbox.path, 'scripts', 'b.sh'), '#!/usr/bin/env bash\necho $1\n');
            git(sandbox.path, ['add', '-A']);
            const environment = {
                PATH: `${join(import.meta.dir, '../../../../.mise/gspot')}${delimiter}${toolsPath([])}`,
                NO_COLOR: '1',
            };
            const commit = git(sandbox.path, ['commit', '-qm', 'bad'], environment);
            expect(commit.code).not.toBe(0);
            expect(`${commit.stdout}${commit.stderr}`).toContain('SC2086');
            expect(commit.stdout + commit.stderr).toContain('reproduce: gspot check --only bash/shellcheck --staged');
            expect(commit.stdout + commit.stderr).toContain('Bypass this hook once: git commit --no-verify');
            await Bun.write(join(sandbox.path, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "$1"\n');
            expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
            const corrected = git(sandbox.path, ['commit', '-qm', 'Correct shell input'], environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const clone = join(cloneRoot.path, 'clone');
            const cloned = git(sandbox.path, ['clone', '--quiet', '--no-local', sandbox.path, clone]);
            expect(cloned.code, cloned.stdout + cloned.stderr).toBe(0);
            const uninstalled = await run(clone, ['check', '--only', 'bash/shellcheck', '--no-cache']);
            expect(uninstalled.code, uninstalled.stdout + uninstalled.stderr).toBe(0);
            expect((uninstalled.stdout + uninstalled.stderr).match(/gspot install/gu)).toHaveLength(1);
            for (let attempt = 0; attempt < 2; attempt++) {
                const installation = await run(clone, ['install']);
                expect(installation.code, installation.stdout + installation.stderr).toBe(0);
                const status = git(clone, ['status', '--porcelain']);
                expect(status.code, status.stderr).toBe(0);
                expect(status.stdout).toBe('');
            }
            const ready = await run(clone, ['check', '--only', 'bash/shellcheck', '--no-cache']);
            expect(ready.code, ready.stdout + ready.stderr).toBe(0);
            expect(ready.stdout + ready.stderr).not.toContain('Configured hooks are not ready');
            await Bun.write(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho $1\n');
            expect(git(clone, ['add', 'scripts/b.sh']).code).toBe(0);
            const rejected = git(clone, ['commit', '-qm', 'Unquoted shell input'], environment);
            expect(rejected.code).not.toBe(0);
            expect(rejected.stdout + rejected.stderr).toContain('SC2086');
            await Bun.write(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "${1:-ready}"\n');
            expect(git(clone, ['add', 'scripts/b.sh']).code).toBe(0);
            const accepted = git(clone, ['commit', '-qm', 'Quote shell input'], environment);
            expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});

test(
    'pre-push checks exact supplied objects, tags, force pushes, and new refs while preserving the working tree',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
            'changed.sh': 'echo base\n',
            'legacy.sh': 'if then\n',
        });
        for (const args of [
            ['init', '-q'],
            ['add', '-A'],
            ['commit', '-qm', 'base'],
        ])
            expect(git(sandbox.path, args).code).toBe(0);
        const base = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        writeFileSync(join(sandbox.path, 'changed.sh'), 'echo reviewed\n');
        expect(git(sandbox.path, ['add', 'changed.sh']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'reviewed']).code).toBe(0);
        const reviewed = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        expect(git(sandbox.path, ['branch', 'reviewed', reviewed]).code).toBe(0);
        writeFileSync(join(sandbox.path, 'changed.sh'), 'if then\n');
        expect(git(sandbox.path, ['add', 'changed.sh']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'unreviewed']).code).toBe(0);
        const broken = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        writeFileSync(join(sandbox.path, 'changed.sh'), 'echo repaired only in the working tree\n');
        writeFileSync(join(sandbox.path, 'gspot.toml'), 'invalid working policy');
        const command = [
            process.execPath,
            gspot,
            'check',
            '--push',
            '--only',
            'bash/syntax',
            '--json',
            '--',
            'origin',
            'unused',
        ];
        const passing = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/reviewed ${base}\n`,
        });
        expect(passing.code, passing.stdout + passing.stderr).toBe(0);
        const first = JSON.parse(passing.stdout).revisions;
        expect(first).toHaveLength(1);
        const firstReport = reportSchema.parse(first[0].report);
        expect(firstReport.comparison).toStrictEqual({ content: 'commit', reference: reviewed });
        expect(firstReport.checks[0]?.status).toBe('ok');
        expect(firstReport.checks[0]?.files).toBe(1);
        const failing = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${broken} refs/heads/main ${base}\n`,
        });
        expect(failing.code, failing.stdout + failing.stderr).toBe(1);
        expect(
            reportSchema
                .parse(JSON.parse(failing.stdout).revisions[0].report)
                .checks[0]?.findings.map((finding) => finding.file),
        ).toStrictEqual(['changed.sh', 'changed.sh']);
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
        const failedReport = reportSchema.parse(JSON.parse(failing.stdout).revisions[0].report);
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
        const multiple = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/broken ${broken} refs/heads/one ${base}\nrefs/heads/reviewed ${reviewed} refs/heads/two ${base}\n`,
        });
        expect(multiple.code, multiple.stdout + multiple.stderr).toBe(1);
        const saved = pushReportSchema.parse(
            JSON.parse(readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8')),
        );
        expect(saved).toStrictEqual(JSON.parse(multiple.stdout));
        expect(saved.revisions.map((revision) => revision.report.exitCode)).toStrictEqual([1, 0]);
        const sarif = JSON.parse(readFileSync(join(sandbox.path, '.gspot/reports/report.sarif'), 'utf8'));
        expect(sarif.runs).toHaveLength(2);
        expect(
            sarif.runs.map(
                (entry: { properties: { comparison: { reference: string } } }) => entry.properties.comparison.reference,
            ),
        ).toStrictEqual([broken, reviewed]);
        expect(sarif.runs[0].results).toHaveLength(2);
        expect(sarif.runs[1].results).toHaveLength(0);
        const duplicated = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/one ${base}\nrefs/heads/also-reviewed ${reviewed} refs/heads/two ${base}\n`,
        });
        expect(duplicated.code, duplicated.stdout + duplicated.stderr).toBe(0);
        expect(JSON.parse(duplicated.stdout).revisions).toHaveLength(1);
        expect(JSON.parse(duplicated.stdout).revisions[0].refs).toHaveLength(2);
        const forced = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/rewound ${base} refs/heads/main ${broken}\n`,
        });
        expect(forced.code, forced.stdout + forced.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(forced.stdout).revisions[0].report).checks[0]?.files).toBe(1);
        expect(git(sandbox.path, ['remote', 'add', 'origin', 'unused']).code).toBe(0);
        expect(git(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]).code).toBe(0);
        const zero = '0'.repeat(base.length);
        const newRef = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(newRef.code, newRef.stdout + newRef.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(newRef.stdout).revisions[0].report).checks[0]?.files).toBe(1);
        expect(git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/fetched/origin/*']).code).toBe(
            0,
        );
        expect(git(sandbox.path, ['update-ref', '-d', 'refs/remotes/origin/main']).code).toBe(0);
        expect(git(sandbox.path, ['update-ref', 'refs/fetched/origin/main', base]).code).toBe(0);
        const mapped = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(mapped.code, mapped.stdout + mapped.stderr).toBe(0);
        expect(pushReportSchema.parse(JSON.parse(mapped.stdout)).revisions[0]?.commits).toStrictEqual([reviewed]);
        expect(git(sandbox.path, ['config', '--add', 'remote.origin.fetch', '^refs/heads/main']).code).toBe(0);
        const excluded = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(excluded.code, excluded.stdout + excluded.stderr).toBe(1);
        expect(
            pushReportSchema
                .parse(JSON.parse(excluded.stdout))
                .revisions[0]?.report.checks[0]?.findings.map((finding) => finding.file),
        ).toStrictEqual(['legacy.sh', 'legacy.sh']);
        expect(git(sandbox.path, ['config', '--unset-all', 'remote.origin.fetch']).code).toBe(0);
        expect(
            git(sandbox.path, ['config', 'remote.origin.fetch', '+refs/heads/main:refs/fetched/origin/main']).code,
        ).toBe(0);
        const exact = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(exact.code, exact.stdout + exact.stderr).toBe(0);
        expect(pushReportSchema.parse(JSON.parse(exact.stdout)).revisions[0]?.commits).toStrictEqual([reviewed]);
        const noFetched = await runProcess(command.slice(0, -2).concat('unseen', 'unused'), {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`,
        });
        expect(noFetched.code, noFetched.stdout + noFetched.stderr).toBe(1);
        expect(
            reportSchema
                .parse(JSON.parse(noFetched.stdout).revisions[0].report)
                .checks[0]?.findings.map((finding) => finding.file),
        ).toStrictEqual(['legacy.sh', 'legacy.sh']);
        expect(git(sandbox.path, ['tag', '-a', '-m', 'reviewed tag', 'reviewed-tag', reviewed]).code).toBe(0);
        const tag = git(sandbox.path, ['rev-parse', 'reviewed-tag']).stdout.trim();
        const tagged = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/tags/reviewed-tag ${tag} refs/tags/reviewed-tag ${base}\n`,
        });
        expect(tagged.code, tagged.stdout + tagged.stderr).toBe(0);
        expect(JSON.parse(tagged.stdout).revisions[0].object).toBe(reviewed);
        const deleted = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `(delete) ${zero} refs/heads/main ${broken}\n`,
        });
        expect(deleted.code, deleted.stdout + deleted.stderr).toBe(0);
        expect(JSON.parse(deleted.stdout).revisions).toStrictEqual([]);
        expect(JSON.parse(deleted.stdout).notApplicable[0].reason).toBe('deleted ref');
        const missing = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/reviewed ${reviewed} refs/heads/main ${'f'.repeat(base.length)}\n`,
        });
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect(JSON.parse(missing.stdout).error).toBe('SelectionError');
        const blob = git(sandbox.path, ['hash-object', '-w', 'changed.sh']).stdout.trim();
        const nonCommit = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/tags/data ${blob} refs/tags/data ${zero}\n`,
        });
        expect(nonCommit.code, nonCommit.stdout + nonCommit.stderr).toBe(0);
        expect(JSON.parse(nonCommit.stdout).notApplicable[0].reason).toBe('non-commit object');
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(broken);
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe('invalid working policy');
        expect(readFileSync(join(sandbox.path, 'changed.sh'), 'utf8')).toBe('echo repaired only in the working tree\n');
        writeFileSync(
            join(sandbox.path, 'gspot.toml'),
            'version = 1\nconfigurations = ["bash"]\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        );
        const configured = await run(sandbox.path, ['set', 'hooks.push', 'all']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        expect(git(sandbox.path, ['add', 'gspot.toml', 'changed.sh']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'full pushed tree']).code).toBe(0);
        const allObject = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        const all = await runProcess(command, {
            cwd: sandbox.path,
            stdin: `refs/heads/main ${allObject} refs/heads/main ${broken}\n`,
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

test('a hook selects configuration below the Git root and checks its exact index', async () => {
    await using sandbox = await testdir();
    await using launcher = await testdir();
    const project = join(sandbox.path, 'nested config');
    await createFileTree(launcher.path, {
        gspot: `#!${process.execPath}\nconst child = Bun.spawn([process.execPath, ${JSON.stringify(gspot)}, ...process.argv.slice(2)], {stdin:'inherit',stdout:'inherit',stderr:'inherit'});process.exit(await child.exited);\n`,
    });
    chmodSync(join(launcher.path, 'gspot'), 0o755);
    await createFileTree(sandbox.path, {
        'nested config/gspot.toml': `version = 1
configurations = []
[rules]
install = false
[hooks]
tool = "gspot"
[[check]]
name = "project/content"
stage = "commit"
paths = ["source.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'if ((await Bun.file("source.txt").text()).trim() === "invalid") { console.log("Indexed defect"); process.exitCode = 1; }'])}
`,
        'nested config/source.txt': 'invalid\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const installed = await run(project, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await Bun.write(join(project, 'source.txt'), 'corrected working tree\n');
    const environment = { PATH: `${launcher.path}${delimiter}${toolsPath([])}` };
    const rejected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout + rejected.stderr).toContain('Indexed defect');
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('corrected working tree\n');
    expect(git(sandbox.path, ['add', 'nested config/source.txt']).code).toBe(0);
    const corrected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
