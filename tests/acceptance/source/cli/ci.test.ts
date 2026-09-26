import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { delimiter, join } from 'node:path';
import { git } from '#tests/support/cli/git.ts';
import { createFileTree, testdir } from 'testdirs';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';
import { gspot, run, runProcess } from '#tests/support/cli/command.ts';

type Step = { run?: string; uses?: string; if?: string; with?: Record<string, string> };
type Generated = {
    gspot: { script: string[]; artifacts: { paths: string[]; when: string; reports: { codequality: string } } };
    jobs: Record<string, { steps: Step[] }>;
};
type Retention = { always: boolean; keepsCodequality: boolean; manualStage?: 'manual job only' | 'every job' };

const CODEQUALITY_REPORT = '.gspot/reports/report.codequality.json';
const RETENTION: Record<'gitlab' | 'github', Retention> = {
    gitlab: { always: true, keepsCodequality: true },
    github: { always: true, keepsCodequality: true, manualStage: 'manual job only' },
};

// What the generated job says about keeping reports and running the manual stage, in one shape per provider.
function retention(provider: 'gitlab' | 'github', generated: Generated): Retention {
    if (provider === 'gitlab')
        return {
            always: generated.gspot.artifacts.when === 'always',
            keepsCodequality: generated.gspot.artifacts.reports.codequality === CODEQUALITY_REPORT,
        };
    const check = generated.jobs['check-ubuntu']!.steps;
    const manual = generated.jobs['manual-ubuntu']!.steps;
    const artifact = check.find((step) => step.uses?.startsWith('actions/upload-artifact@'))!;
    const runsManual = (steps: Step[]) => steps.some((step) => step.run?.includes('--stage manual'));
    return {
        always: artifact.if?.includes('always()') === true,
        keepsCodequality: artifact.with?.['path']?.includes(CODEQUALITY_REPORT) === true,
        manualStage: runsManual(manual) && !runsManual(check) ? 'manual job only' : 'every job',
    };
}

test.each(['gitlab', 'github'] as const)(
    'the generated %s job verifies its download, checks exact changed objects, retains reports, and accepts corrections',
    async (provider) => {
        await using repository = await testdir();
        await using executables = await testdir();
        const pipelinePath = provider === 'gitlab' ? '.gitlab-ci.yml' : '.github/workflows/application.yml';
        const pipeline =
            provider === 'gitlab'
                ? 'stages: [test]\napplication:\n  script: echo authored-job\n'
                : 'on: push\njobs:\n  application:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo authored-job\n';
        const policy = `version = 1
configurations = []
[rules]
install = false
[ci]
provider = "${provider}"
[[check]]
name = "project/syntax"
stage = "commit"
paths = ["*.sh"]
command = ${JSON.stringify([process.execPath, '-e', 'for (const path of process.argv.slice(1)) { const result = Bun.spawnSync(["/bin/bash", "-n", path]); if (result.exitCode !== 0) { console.log(path + ": syntax error"); process.exitCode = 1; } }', '{files}'])}
[check.output]
format = "lines"
`;
        await createFileTree(repository.path, {
            'gspot.toml': policy,
            [pipelinePath]: pipeline,
            'changed.sh': 'echo valid\n',
            'legacy.sh': 'if then\n',
        });
        for (const args of [
            ['init', '-q'],
            ['config', 'user.email', 'ci@example.com'],
            ['config', 'user.name', 'CI acceptance'],
        ]) {
            const result = git(repository.path, args);
            expect(result.code, result.stderr).toBe(0);
        }
        const applied = await run(repository.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const commit = (message: string) => {
            expect(git(repository.path, ['add', '-A']).code).toBe(0);
            const committed = git(repository.path, ['commit', '-qm', message]);
            expect(committed.code, committed.stderr).toBe(0);
            return git(repository.path, ['rev-parse', 'HEAD']).stdout.trim();
        };
        const base = commit('base');
        writeFileSync(join(repository.path, 'changed.sh'), 'if then\n');
        const target = commit('invalid change');
        const binary = `#!/usr/bin/env bun
const child = Bun.spawnSync([process.execPath, ${JSON.stringify(gspot)}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(child.exitCode);
`;
        const digest = createHash('sha256').update(binary).digest('hex');
        let corrupt = false;
        const server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch(request) {
                const name = new URL(request.url).pathname.split('/').at(-1)!;
                return new Response(
                    name === 'checksums.txt'
                        ? ['gspot-darwin-arm64', 'gspot-darwin-x64', 'gspot-linux-arm64', 'gspot-linux-x64']
                              .map((asset) => `${corrupt ? '0'.repeat(64) : digest}  ${asset}\n`)
                              .join('')
                        : binary,
                );
            },
        });
        try {
            const curl = Bun.which('curl');
            expect(curl).not.toBeNull();
            writeFileSync(
                join(executables.path, 'curl'),
                `#!/usr/bin/env bun
    const args = process.argv.slice(2).map(value => value.startsWith('https://github.com/stefanionescu/gspot/releases/download/') ? ${JSON.stringify(`http://127.0.0.1:${server.port}`)} + new URL(value).pathname : value);
    process.exit(Bun.spawnSync([${JSON.stringify(curl)}, ...args], {stdin:'inherit',stdout:'inherit',stderr:'inherit'}).exitCode);
    `,
            );
            chmodSync(join(executables.path, 'curl'), 0o755);
            const workflowPath = provider === 'gitlab' ? '.gitlab/ci/gspot.yml' : '.github/workflows/gspot.yml';
            const generated = Bun.YAML.parse(readFileSync(join(repository.path, workflowPath), 'utf8')) as Generated;
            let script =
                provider === 'gitlab'
                    ? generated.gspot.script
                    : generated.jobs['check-ubuntu']!.steps.flatMap((step) =>
                          step.run === undefined ? [] : [step.run],
                      );
            const execute = (comparison: string) =>
                runProcess(['/bin/bash', '-e', '-c', script.join('\n')], {
                    cwd: repository.path,
                    env: {
                        PATH: `${executables.path}${delimiter}${environmentVariables()['PATH']}`,
                        CI_COMMIT_BEFORE_SHA: comparison,
                        CI_MERGE_REQUEST_DIFF_BASE_SHA: '',
                        GSPOT_CI_BASE: comparison,
                        RUNNER_TEMP: executables.path,
                        GITHUB_PATH: join(executables.path, 'github-path'),
                        NO_COLOR: '1',
                    },
                    timeoutMs: 30_000,
                });
            const invalid = await execute(base);
            expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
            const reportPath = join(repository.path, '.gspot/reports/report.json');
            const failed = JSON.parse(readFileSync(reportPath, 'utf8'));
            expect(failed.revisions[0].object).toBe(target);
            expect(failed.revisions[0].report.checks[0].status).toBe('fail');
            expect(invalid.stdout).toContain('changed.sh');
            expect(JSON.stringify(failed.revisions[0].report.checks[0].findings)).not.toContain('legacy.sh');
            for (const path of [
                '.gspot/reports/report.json',
                '.gspot/reports/report.sarif',
                '.gspot/reports/report.codequality.json',
            ])
                expect(readFileSync(join(repository.path, path)).length).toBeGreaterThan(0);
            expect(retention(provider, generated)).toMatchObject(RETENTION[provider]);
            writeFileSync(join(repository.path, 'changed.sh'), 'echo corrected\n');
            const corrected = commit('correct syntax');
            const valid = await execute(base);
            expect(valid.code, valid.stdout + valid.stderr).toBe(0);
            expect(JSON.parse(readFileSync(reportPath, 'utf8')).revisions[0].object).toBe(corrected);
            const firstPush = await execute('0'.repeat(40));
            expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
            expect(firstPush.stdout).toContain('legacy.sh');
            const held = readFileSync(reportPath);
            const malformed = await execute('$(touch injected)');
            expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
            expect(malformed.stderr).toContain('Invalid CI comparison object');
            expect(readFileSync(reportPath)).toStrictEqual(held);
            const missing = await execute('f'.repeat(40));
            expect(missing.code).not.toBe(0);
            expect(readFileSync(reportPath)).toStrictEqual(held);
            corrupt = true;
            const refused = await execute(base);
            expect(refused.code).toBe(1);
            expect(refused.stderr).toContain('checksum does not match');
            expect(readFileSync(reportPath)).toStrictEqual(held);
            corrupt = false;
            const policyBefore = readFileSync(join(repository.path, 'gspot.toml'));
            const invalidSetting = await run(repository.path, ['set', 'ci.run', 'unknown']);
            expect(invalidSetting.code).toBe(2);
            expect(readFileSync(join(repository.path, 'gspot.toml'))).toStrictEqual(policyBefore);
            for (const args of [['set', 'ci.run', 'all'], ['set', 'ci.sarif', 'false'], ['apply']]) {
                const changed = await run(repository.path, args);
                expect(changed.code, changed.stdout + changed.stderr).toBe(0);
            }
            commit('check the full tree in CI');
            const full = Bun.YAML.parse(readFileSync(join(repository.path, workflowPath), 'utf8')) as typeof generated;
            // Code scanning is a separate job that ci.run = "all" does not add; GitLab has no jobs table at all.
            expect(provider === 'github' && 'code-scanning' in full.jobs).toBe(false);
            script =
                provider === 'gitlab'
                    ? full.gspot.script
                    : full.jobs['check-ubuntu']!.steps.flatMap((step) => (step.run === undefined ? [] : [step.run]));
            const all = await execute(base);
            expect(all.code, all.stdout + all.stderr).toBe(1);
            expect(all.stdout).toContain('legacy.sh');
            expect(readFileSync(join(repository.path, pipelinePath), 'utf8')).toBe(pipeline);
            expect(readFileSync(join(repository.path, 'changed.sh'), 'utf8')).toBe('echo corrected\n');
        } finally {
            await server.stop(true);
        }
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
            '--configurations',
            'none',
            '--no-runner',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const proposal = JSON.parse(result.stdout) as { policy: string; plan: { retained: unknown; write: unknown } };
        expect(/provider = "(\w+)"/u.exec(proposal.policy)?.[1] ?? 'none').toBe(provider);
        expect(JSON.stringify(proposal.plan)).toContain(note);
        expect(readFileSync(join(repository.path, path), 'utf8')).toBe(content);
        expect(await Bun.file(join(repository.path, 'gspot.toml')).exists()).toBe(false);
    },
);
