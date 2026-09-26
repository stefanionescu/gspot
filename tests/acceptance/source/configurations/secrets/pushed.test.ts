// Pushed history is scanned for secrets that a later commit removed, through Gitleaks and pinned TruffleHog.
import { expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { git } from '#tests/support/cli/git.ts';
import { createFileTree, testdir } from 'testdirs';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { pushReportSchema } from '#cli/execution/report.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { PLANTED_KEY_ID, PLANTED_SETTINGS } from '#tests/support/cli/secrets.ts';
import { gspot, PLANTED_TIMEOUT_MS, run, runProcess } from '#tests/support/cli/command.ts';

test(
    'pushed secret history includes removed secrets and excludes unrelated refs despite identical final trees',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["secrets"]\n[rules]\ninstall = false\n',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
        const base = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        const tree = git(sandbox.path, ['rev-parse', 'HEAD^{tree}']).stdout.trim();
        const good = git(sandbox.path, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']).stdout.trim();
        await Bun.write(join(sandbox.path, 'settings.py'), PLANTED_SETTINGS);
        expect(git(sandbox.path, ['add', 'settings.py']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'feat: settings']).code).toBe(0);
        const leaked = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        expect(git(sandbox.path, ['rm', 'settings.py']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'fix: remove settings']).code).toBe(0);
        const removed = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        expect(git(sandbox.path, ['rev-parse', 'HEAD^{tree}']).stdout.trim()).toBe(tree);
        const command = [process.execPath, gspot, 'check', '--push', '--only', 'secrets/gitleaks', '--json'];
        const options = { cwd: sandbox.path, env: { PATH: toolsPath(['gitleaks']) } };
        const rejected = await runProcess(command, {
            ...options,
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/removed ${removed} refs/heads/removed ${base}\n`,
        });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = pushReportSchema.parse(JSON.parse(rejected.stdout));
        expect(report.revisions).toHaveLength(1);
        expect(report.revisions[0]?.commits).toContain(leaked);
        expect(report.revisions[0]?.report.checks).toMatchObject([{ check: 'secrets/gitleaks', status: 'fail' }]);
        expect(report.revisions[0]?.report.checks[0]?.findings).toContainEqual(
            expect.objectContaining({ rule: 'aws-access-token', file: 'settings.py', line: 1 }),
        );
        expect(rejected.stdout).not.toContain(PLANTED_KEY_ID);
        await Bun.write(join(sandbox.path, 'settings.py'), PLANTED_SETTINGS);
        const corrected = await runProcess(command, {
            ...options,
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(pushReportSchema.parse(JSON.parse(corrected.stdout)).revisions[0]?.report.checks[0]?.status).toBe('ok');
        const alreadyRemote = await runProcess(command, {
            ...options,
            stdin: `refs/heads/removed ${removed} refs/heads/removed ${leaked}\n`,
        });
        expect(alreadyRemote.code, alreadyRemote.stdout + alreadyRemote.stderr).toBe(0);
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(removed);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'verified-secret history scans every changed blob through pinned TruffleHog and never reports raw credentials',
    async () => {
        await using sandbox = await testdir();
        await using launcher = await testdir();
        const firstToken = ['gspot-acceptance-', 'token-first'].join('');
        const secondToken = ['gspot-acceptance-', 'token-second'].join('');
        const requests: unknown[] = [];
        const verifier = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            async fetch(request) {
                requests.push(await request.json());
                return new Response('{}', { status: 200 });
            },
        });
        try {
            const native = Bun.which('trufflehog', { PATH: toolsPath(['trufflehog']) });
            expect(native).not.toBeNull();
            const config = join(launcher.path, 'detectors.json');
            const mode = join(launcher.path, 'mode');
            writeFileSync(mode, 'native');
            writeFileSync(
                config,
                JSON.stringify({
                    detectors: [
                        {
                            name: 'GspotAcceptance',
                            keywords: ['gspot-acceptance-token-'],
                            regex: { token: '(gspot-acceptance-token-[a-z]+)' },
                            verify: [{ endpoint: verifier.url.toString(), unsafe: true }],
                        },
                    ],
                }),
            );
            await createFileTree(launcher.path, {
                trufflehog: `#!/usr/bin/env bun\nimport { readFileSync } from 'node:fs';\nconst args = process.argv.slice(2);\nconst mode = readFileSync(${JSON.stringify(mode)}, 'utf8');\nif (!args.includes('--version') && mode !== 'native') { console.log(${JSON.stringify(firstToken)}); console.error(${JSON.stringify(secondToken)}); process.exit(mode === 'malformed' ? 0 : 2); }\nconst child = Bun.spawn([${JSON.stringify(native)}, ...args, ...(args.includes('--version') ? [] : ['--config', ${JSON.stringify(config)}, '--include-detectors=CustomRegex'])], {stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'});\nprocess.exit(await child.exited);\n`,
            });
            chmodSync(join(launcher.path, 'trufflehog'), 0o755);
            await createFileTree(sandbox.path, {
                'gspot.toml': 'version = 1\nconfigurations = ["secrets"]\n[rules]\ninstall = false\n',
            });
            expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
            const applied = await run(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
            expect(git(sandbox.path, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
            const base = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
            const tree = git(sandbox.path, ['rev-parse', 'HEAD^{tree}']).stdout.trim();
            const good = git(sandbox.path, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']).stdout.trim();
            await createFileTree(sandbox.path, { 'first.txt': firstToken, 'second.txt': secondToken });
            expect(git(sandbox.path, ['add', 'first.txt', 'second.txt']).code).toBe(0);
            expect(git(sandbox.path, ['commit', '-qm', 'feat: settings']).code).toBe(0);
            const leaked = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
            expect(git(sandbox.path, ['rm', 'first.txt', 'second.txt']).code).toBe(0);
            expect(git(sandbox.path, ['commit', '-qm', 'fix: remove settings']).code).toBe(0);
            const removed = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
            const command = [process.execPath, gspot, 'check', '--push', '--only', 'secrets/trufflehog', '--json'];
            const options = {
                cwd: sandbox.path,
                env: { PATH: `${launcher.path}${delimiter}${toolsPath(['trufflehog'])}` },
            };
            const input = `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/removed ${removed} refs/heads/removed ${base}\n`;
            const rejected = await runProcess(command, { ...options, stdin: input });
            expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
            const report = pushReportSchema.parse(JSON.parse(rejected.stdout));
            const findings = report.revisions[0]?.report.checks[0]?.findings ?? [];
            expect(
                findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right)),
            ).toStrictEqual(['first.txt', 'second.txt']);
            expect(findings.every((finding) => finding.message.includes(leaked))).toBe(true);
            expect(requests).toContainEqual({ GspotAcceptance: { token: expect.arrayContaining([firstToken]) } });
            expect(requests).toContainEqual({ GspotAcceptance: { token: expect.arrayContaining([secondToken]) } });
            const saved =
                readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8') +
                readFileSync(join(sandbox.path, '.gspot/reports/report.sarif'), 'utf8') +
                readFileSync(join(sandbox.path, '.gspot/reports/report.codequality.json'), 'utf8');
            for (const token of [firstToken, secondToken])
                expect(rejected.stdout + rejected.stderr + saved).not.toContain(token);
            for (const failure of ['malformed', 'crashed']) {
                writeFileSync(mode, failure);
                const broken = await runProcess(command, { ...options, stdin: input });
                expect(broken.code, broken.stdout + broken.stderr).toBe(2);
                expect(pushReportSchema.parse(JSON.parse(broken.stdout)).revisions[0]?.report.checks[0]?.status).toBe(
                    'error',
                );
                for (const token of [firstToken, secondToken])
                    expect(broken.stdout + broken.stderr).not.toContain(token);
            }
            writeFileSync(mode, 'native');
            requests.length = 0;
            const corrected = await runProcess(command, {
                ...options,
                stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
            });
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(pushReportSchema.parse(JSON.parse(corrected.stdout)).revisions[0]?.report.checks[0]?.status).toBe(
                'ok',
            );
            expect(requests).toStrictEqual([]);
            expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(removed);
        } finally {
            await verifier.stop(true);
        }
    },
    PLANTED_TIMEOUT_MS,
);
