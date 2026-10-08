import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { levelSchema } from '#cli/parsers/schema/settings.ts';
import { spawnGspot, buildRunOptions } from '#tests/harness/gspot.ts';

test('Docker configuration scans isolate deepest scopes and retain scoped advisory exceptions', async () => {
    await using sandbox = await testdir();
    const source =
        'FROM node:22.11.0-bookworm-slim\nWORKDIR /app\nUSER root\nHEALTHCHECK CMD ["node", "--version"]\nCMD ["node", "index.js"]\n';
    const paths = ['Dockerfile', 'app/Dockerfile', 'app/child/Dockerfile', 'sibling/Dockerfile'];
    const policy = buildPolicy(['docker'], {
        tables: '[scope."app"]\n[scope."app/child"]\n[scope."sibling"]\n[[ignore]]\ncheck = "docker/trivy-config"\nrule = "DS-0002"\npaths = ["app/**"]\nreason = "This test exercises scoped advisory exceptions."\n',
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': 'untracked/\n',
        ...Object.fromEntries(paths.map((path) => [path, source])),
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'untracked/Dockerfile'), source);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ stage: 'push', only: ['docker/trivy-config'] });
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
    expect(
        failed.report.checks.map((check) => ({
            scope: check.scope,
            status: check.status,
            files: check.findings.map((finding) => finding.file),
        })),
    ).toStrictEqual([
        { scope: '', status: 'failed', files: ['Dockerfile'] },
        { scope: 'app', status: 'passed', files: [] },
        { scope: 'app/child', status: 'passed', files: [] },
        { scope: 'sibling', status: 'failed', files: ['sibling/Dockerfile'] },
    ]);
    for (const path of ['Dockerfile', 'sibling/Dockerfile'])
        await Bun.write(join(sandbox.path, path), source.replace('USER root', 'USER node'));
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
});

test.each(levelSchema.options)(
    'Hadolint keeps apt and apk version checks only at level %s in root and child scopes',
    async (level) => {
        await using sandbox = await testdir();
        const debian =
            'FROM debian:12\nRUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*\nUSER 1000\n';
        const alpine = 'FROM alpine:3.20.3\nRUN apk add --no-cache curl\nUSER 1000\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['docker'], { level, tables: '[scope.app]\nconfigurations = ["docker"]\n' }),
            Dockerfile: debian,
            'Dockerfile.alpine': alpine,
            'app/Dockerfile': debian,
            'app/Dockerfile.alpine': alpine,
        });
        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        for (const scope of ['', 'app']) {
            const config = join('.gspot/config', scope, 'hadolint.yml');
            const prefix = scope === '' ? '' : `${scope}/`;
            const result = await runTestCommand(
                [
                    'hadolint',
                    '--config',
                    config,
                    '--format',
                    'json',
                    `${prefix}Dockerfile`,
                    `${prefix}Dockerfile.alpine`,
                ],
                { cwd: sandbox.path },
            );
            expect(result.code, result.stdout + result.stderr).toBe(level === 'all' ? 1 : 0);
            expect(JSON.parse(result.stdout)).toMatchObject(
                level === 'all' ? [{ code: 'DL3008' }, { code: 'DL3018' }] : [],
            );
            await Bun.write(join(sandbox.path, `${prefix}Dockerfile`), debian.replace('debian:12', 'debian:latest'));
            const unpinned = await runTestCommand(
                ['hadolint', '--config', config, '--format', 'json', `${prefix}Dockerfile`],
                { cwd: sandbox.path },
            );
            expect(JSON.parse(unpinned.stdout)).toContainEqual(expect.objectContaining({ code: 'DL3007' }));
        }
    },
);

test.each(levelSchema.options)('Trivy scans only Dockerfiles at level %s in root and child scopes', async (level) => {
    await using sandbox = await testdir();
    const dockerfile = 'FROM node:22.11.0-bookworm-slim\nUSER root\n';
    const terraform =
        'resource "aws_security_group" "open" {\n  ingress {\n    from_port = 22\n    to_port = 22\n    protocol = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['docker'], { level, tables: '[scope.app]\nconfigurations = ["docker"]\n' }),
        Dockerfile: dockerfile,
        'main.tf': terraform,
        'app/main.tf': terraform,
    });
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    for (const scope of ['', 'app']) {
        await Bun.write(join(sandbox.path, scope, 'Dockerfile'), dockerfile);
        const config = join('.gspot/config', scope, 'trivy.yml');
        const command = [
            'trivy',
            'config',
            '--quiet',
            '--skip-check-update',
            '--misconfig-scanners',
            'dockerfile',
            '--config',
            config,
            '--exit-code',
            '10',
            '--format',
            'json',
            scope || '.',
        ];
        const result = await runTestCommand(command, { cwd: sandbox.path });
        expect(result.code, result.stdout + result.stderr).toBe(10);
        expect(JSON.parse(result.stdout)).toMatchObject({
            Results: [
                {
                    Type: 'dockerfile',
                    Misconfigurations: [{ ID: 'DS-0002', Severity: 'HIGH' }],
                },
            ],
        });
        await Bun.write(join(sandbox.path, scope, 'Dockerfile'), dockerfile.replace('USER root', 'USER node'));
        const corrected = await runTestCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    }
});
