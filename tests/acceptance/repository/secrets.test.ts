import { run as runProcess } from '#cli/platform/spawn.ts';
import { pushReportSchema } from '#cli/run/report-schema.ts';
import { gspot } from '#tests/harness/planted.ts';
// Planted repository for the secrets preset: a staged key, a pushed key, a tracked environment file and a baseline with no reason.
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';

import {
    commitAll,
    install,
    git,
    PLANTED_TIMEOUT_MS,
    run,
    runPlanted,
    script,
    toolsPath,
} from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'secrets',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
// Built from halves so no scanner of this repository reads a key in the test itself.
const KEY_ID = ['AKIA', 'IOSFODNN7', 'EXAMPLA'].join('');
const SETTINGS = `aws_access_key_id = "${KEY_ID}"\n`;
const BASELINE = JSON.stringify([
    { Fingerprint: 'old.py:aws-access-token:1', File: 'old.py', RuleID: 'aws-access-token' },
    { Fingerprint: 'abc123:gone.md:generic-api-key:4', File: 'gone.md', RuleID: 'generic-api-key', Commit: 'abc123' },
]);

describe('the secrets preset', () => {
    test(
        'a staged key, a pushed key, a tracked environment file and an unexplained baseline entry are each reported',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['gitleaks']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const clean = await run(sandbox.path, ['check', '--stage', 'commit', '--no-cache'], environment);
            expect(clean.code).toBe(0);

            await Bun.write(join(sandbox.path, 'settings.py'), SETTINGS);
            git(sandbox.path, ['add', 'settings.py']);
            const staged = await run(
                sandbox.path,
                ['check', '--only', 'secrets/gitleaks-staged', '--no-cache'],
                environment,
            );
            expect(staged.code, staged.stdout).toBe(1);
            expect(staged.stdout).toContain('settings.py:1');
            expect(staged.stdout).toContain('aws-access-token');
            expect(staged.stdout).not.toContain(KEY_ID);

            git(sandbox.path, ['commit', '-qm', 'feat: add settings', '--no-verify']);
            const pushed = await run(sandbox.path, ['check', '--only', 'secrets/gitleaks', '--no-cache'], environment);
            expect(pushed.code, pushed.stdout).toBe(1);
            expect(pushed.stdout).toContain('settings.py');

            await Bun.write(join(sandbox.path, '.env'), 'TOKEN=value\n');
            git(sandbox.path, ['add', '-f', '.env']);
            const tracked = await run(
                sandbox.path,
                ['check', '--only', 'integrity/env-files', '--no-cache'],
                environment,
            );
            expect(tracked.code).toBe(1);
            expect(tracked.stdout).toContain('.env is tracked');

            const baseline = await runPlanted(
                sandbox.path,
                {
                    check: 'integrity/gitleaks-baseline',
                    files: { '.gspot/gitleaks-baseline.json': BASELINE },
                },
                environment,
            );
            expect(baseline.code).toBe(1);
            expect(baseline.stdout).toContain('has no reason');
            expect(baseline.stdout).toContain('names old.py, which is gone');
            // An entry with a commit lives in history, where a deleted file still holds its value.
            expect(baseline.stdout).not.toContain('names gone.md');
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const network = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(network.checks.map((check) => check.check)).not.toContain('secrets/trufflehog');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});

test(
    'pushed secret history includes removed secrets and excludes unrelated refs despite identical final trees',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\npresets = ["secrets"]\n[rules]\ninstall = false\n',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
        const base = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        const tree = git(sandbox.path, ['rev-parse', 'HEAD^{tree}']).stdout.trim();
        const good = git(sandbox.path, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']).stdout.trim();
        await Bun.write(join(sandbox.path, 'settings.py'), SETTINGS);
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
        expect(
            report.revisions[0]?.report.checks[0]?.findings.some(
                (finding) => finding.rule === 'aws-access-token' && finding.file === 'settings.py',
            ),
        ).toBe(true);
        expect(rejected.stdout).not.toContain(KEY_ID);
        await Bun.write(join(sandbox.path, 'settings.py'), SETTINGS);
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
                'gspot.toml': 'version = 1\npresets = ["secrets"]\n[rules]\ninstall = false\n',
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
            expect(findings.map((finding) => finding.file).sort()).toEqual(['first.txt', 'second.txt']);
            expect(findings.every((finding) => finding.message.includes(leaked))).toBe(true);
            expect(requests).toContainEqual({ GspotAcceptance: { token: expect.arrayContaining([firstToken]) } });
            expect(requests).toContainEqual({ GspotAcceptance: { token: expect.arrayContaining([secondToken]) } });
            const saved =
                readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8') +
                readFileSync(join(sandbox.path, '.gspot/report.sarif'), 'utf8') +
                readFileSync(join(sandbox.path, '.gspot/report.codequality.json'), 'utf8');
            for (const token of [firstToken, secondToken])
                expect(rejected.stdout + rejected.stderr + saved).not.toContain(token);
            for (const failure of ['malformed', 'crashed']) {
                writeFileSync(mode, failure);
                const broken = await runProcess(command, { ...options, stdin: input });
                expect(broken.code, broken.stdout + broken.stderr).toBe(1);
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
            expect(requests).toEqual([]);
            expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(removed);
        } finally {
            verifier.stop(true);
        }
    },
    PLANTED_TIMEOUT_MS,
);
