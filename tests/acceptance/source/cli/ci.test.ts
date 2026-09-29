import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { git } from '#tests/support/cli/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { pushReportSchema } from '#cli/execution/report.ts';
import type { Generated, Retention } from '#tests/types/acceptance/source/cli.ts';
import { RETENTION, CODEQUALITY_REPORT } from '#tests/inputs/acceptance/source/cli/cli.ts';
import { runCiJob, commitCiSource, createCiDownload, prepareCiProject } from '#tests/support/cli/ci.ts';
// What the generated job says about keeping reports and running the manual stage, in one shape per provider.
function retention(provider: 'gitlab' | 'github', generated: Generated): Retention {
    if (provider === 'gitlab')
        return {
            always: generated.gspot.artifacts.when === 'always',
            keepsCodequality: generated.gspot.artifacts.reports.codequality === CODEQUALITY_REPORT,
        };
    const check = generated.jobs['check-ubuntu']!.steps;
    const manual = generated.jobs['manual-ubuntu']!.steps;
    const artifact = check.find((step) => step.uses?.startsWith('actions/upload-artifact@') === true)!;
    return {
        always: artifact.if?.includes('always()') === true,
        keepsCodequality: artifact.with?.['path']?.includes(CODEQUALITY_REPORT) === true,
        manualStage:
            manual.some((step) => step.run?.includes('--stage manual') === true) &&
            !check.some((step) => step.run?.includes('--stage manual') === true)
                ? 'manual job only'
                : 'every job',
    };
}

test.each(['gitlab', 'github'] as const)(
    'generated jobs check changed objects, retain reports, and accept corrected source in %s CI',
    async (provider) => {
        await using repository = await testdir();
        await using executables = await testdir();
        const { base, target, generated } = await prepareCiProject(repository.path, provider);
        await using download = await createCiDownload(executables.path);
        const invalid = await runCiJob(repository.path, generated, download.directory, base, provider);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        const reportPath = join(repository.path, '.gspot/reports/report.json');
        const failed = pushReportSchema.parse(JSON.parse(readFileSync(reportPath, 'utf8')));
        expect(failed.revisions[0]!.object).toBe(target);
        expect(failed.revisions[0]!.report.checks[0]!.status).toBe('fail');
        expect(invalid.stdout).toContain('changed.sh');
        expect(JSON.stringify(failed.revisions[0]!.report.checks[0]!.findings)).not.toContain('legacy.sh');
        for (const path of [
            '.gspot/reports/report.json',
            '.gspot/reports/report.sarif',
            '.gspot/reports/report.codequality.json',
        ])
            expect(readFileSync(join(repository.path, path)).length).toBeGreaterThan(0);
        expect(retention(provider, generated)).toMatchObject(RETENTION[provider]);
        writeFileSync(join(repository.path, 'changed.sh'), 'echo corrected\n');
        const corrected = commitCiSource(repository.path, 'correct syntax');
        const valid = await runCiJob(repository.path, generated, download.directory, base, provider);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        expect(pushReportSchema.parse(JSON.parse(readFileSync(reportPath, 'utf8'))).revisions[0]!.object).toBe(
            corrected,
        );
        const firstPush = await runCiJob(repository.path, generated, download.directory, '0'.repeat(40), provider);
        expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
        expect(firstPush.stdout).toContain('legacy.sh');
    },
    120_000,
);

test.each(['gitlab', 'github'] as const)(
    'invalid comparisons and corrupted downloads preserve reports until correction in %s CI',
    async (provider) => {
        await using repository = await testdir();
        await using executables = await testdir();
        const { base, generated } = await prepareCiProject(repository.path, provider);
        await using download = await createCiDownload(executables.path);
        const initial = await runCiJob(repository.path, generated, download.directory, base, provider);
        expect(initial.code).toBe(1);
        const reportPath = join(repository.path, '.gspot/reports/report.json');
        const held = readFileSync(reportPath);
        const malformed = await runCiJob(repository.path, generated, download.directory, '$(touch injected)', provider);
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(malformed.stderr).toContain('Invalid CI comparison object');
        expect(readFileSync(reportPath)).toStrictEqual(held);
        const missing = await runCiJob(repository.path, generated, download.directory, 'f'.repeat(40), provider);
        expect(missing.code).not.toBe(0);
        expect(readFileSync(reportPath)).toStrictEqual(held);
        download.corrupt = true;
        const refused = await runCiJob(repository.path, generated, download.directory, base, provider);
        expect(refused.code).toBe(1);
        expect(refused.stderr).toContain('checksum does not match');
        expect(readFileSync(reportPath)).toStrictEqual(held);
        download.corrupt = false;
        writeFileSync(join(repository.path, 'changed.sh'), 'echo corrected\n');
        commitCiSource(repository.path, 'correct syntax');
        const corrected = await runCiJob(repository.path, generated, download.directory, base, provider);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    120_000,
);

test.each(['gitlab', 'github'] as const)(
    'full-tree selection preserves authored jobs and rejects an invalid run setting in %s CI',
    async (provider) => {
        await using repository = await testdir();
        await using executables = await testdir();
        const { base, pipeline, pipelinePath, workflowPath } = await prepareCiProject(repository.path, provider);
        await using download = await createCiDownload(executables.path);
        const policyBefore = readFileSync(join(repository.path, 'gspot.toml'));
        const invalidSetting = await run(repository.path, ['set', 'ci.run', 'unknown']);
        expect(invalidSetting.code).toBe(2);
        expect(readFileSync(join(repository.path, 'gspot.toml'))).toStrictEqual(policyBefore);
        for (const args of [['set', 'ci.run', 'all'], ['set', 'ci.sarif', 'false'], ['apply']]) {
            const changed = await run(repository.path, args);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        }
        writeFileSync(join(repository.path, 'changed.sh'), 'echo corrected\n');
        commitCiSource(repository.path, 'check the full tree in CI');
        const full = Bun.YAML.parse(readFileSync(join(repository.path, workflowPath), 'utf8')) as Generated;
        // Code scanning is a separate job that ci.run = "all" does not add; GitLab has no jobs table at all.
        expect(provider === 'github' && 'code-scanning' in full.jobs).toBe(false);
        const all = await runCiJob(repository.path, full, download.directory, base, provider);
        expect(all.code, all.stdout + all.stderr).toBe(1);
        expect(all.stdout).toContain('legacy.sh');
        expect(readFileSync(join(repository.path, pipelinePath), 'utf8')).toBe(pipeline);
        expect(readFileSync(join(repository.path, 'changed.sh'), 'utf8')).toBe('echo corrected\n');
    },
    120_000,
);

// Each row names the provider init proposes and the note or file its plan must carry.
test.each([
    ['Jenkinsfile', 'pipeline { agent any }\n', 'git@github.com:example/project.git', 'none', 'CI retained'],
    [
        '.gitlab-ci.yml',
        'application:\n  script: echo app\n',
        'git@github.com:example/project.git',
        'gitlab',
        'include:',
    ],
    [
        '.github/workflows/application.yml',
        'on: push\njobs:\n  application:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo app\n',
        'git@gitlab.com:example/project.git',
        'github',
        '.github/workflows/gspot.yml',
    ],
    ['README.md', '# Project\n', 'git@gitlab.com:example/project.git', 'gitlab', 'include:'],
    [
        '.gitlab-ci.yml',
        'lint:\n  script: npm run lint\n',
        'git@github.com:example/project.git',
        'none',
        'no duplicate CI job',
    ],
    [
        '.github/workflows/application.yml',
        'on: push\njobs:\n  quality:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: npm run lint\n',
        'git@gitlab.com:example/project.git',
        'none',
        'no duplicate CI job',
    ],
] as const)(
    'init reads %s before its remote and preserves existing CI jobs',
    async (path, content, remote, provider, note) => {
        await using repository = await testdir();
        await createFileTree(repository.path, { [path]: content });
        expect(git(repository.path, ['init', '-q']).code).toBe(0);
        expect(git(repository.path, ['remote', 'add', 'origin', remote]).code).toBe(0);
        const result = await run(repository.path, [
            'init',
            '--dry-run',
            '--json',
            '--yes',
            '--kits',
            'none',
            '--no-runner',
            '--no-hooks',
            '--no-guides',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const plan = JSON.parse(result.stdout) as { policy: string; plan: { retained: unknown; write: unknown } };
        expect(/provider = "(\w+)"/u.exec(plan.policy)?.[1] ?? 'none').toBe(provider);
        expect(JSON.stringify(plan.plan)).toContain(note);
        expect(readFileSync(join(repository.path, path), 'utf8')).toBe(content);
        expect(await Bun.file(join(repository.path, 'gspot.toml')).exists()).toBe(false);
    },
);
