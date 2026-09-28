// Gitleaks and pinned TruffleHog scan pushed history for secrets removed by later commits.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { git } from '#tests/support/cli/git.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { pushReportSchema } from '#cli/execution/report.ts';
import { gspot, runProcess } from '#tests/support/cli/command.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';

import {
    PLANTED_KEY_ID,
    PLANTED_SETTINGS,
    createSecretVerifier,
    prepareSecretHistory,
} from '#tests/support/cli/secrets.ts';

test(
    'pushed secret history includes removed secrets and excludes unrelated refs despite identical final trees',
    async () => {
        await using sandbox = await testdir();
        const { base, tree, good, leaked, removed } = await prepareSecretHistory(sandbox.path, {
            'settings.py': PLANTED_SETTINGS,
        });
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
            containing({ rule: 'aws-access-token', file: 'settings.py', line: 1 }),
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
    'verified-secret history scans every changed blob without exposing raw credentials',
    async () => {
        await using sandbox = await testdir();
        await using launcher = await testdir();
        await using verifier = await createSecretVerifier(launcher.path);
        const { firstToken, secondToken, requests, mode } = verifier;
        const { base, good, leaked, removed } = await prepareSecretHistory(sandbox.path, {
            'first.txt': firstToken,
            'second.txt': secondToken,
        });
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
        expect(requests).toContainEqual({ GspotAcceptance: { token: containingAll([firstToken]) } });
        expect(requests).toContainEqual({ GspotAcceptance: { token: containingAll([secondToken]) } });
        const saved =
            readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8') +
            readFileSync(join(sandbox.path, '.gspot/reports/report.sarif'), 'utf8') +
            readFileSync(join(sandbox.path, '.gspot/reports/report.codequality.json'), 'utf8');
        for (const token of [firstToken, secondToken])
            expect(rejected.stdout + rejected.stderr + saved).not.toContain(token);
        writeFileSync(mode, 'native');
        requests.length = 0;
        const corrected = await runProcess(command, {
            ...options,
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(pushReportSchema.parse(JSON.parse(corrected.stdout)).revisions[0]?.report.checks[0]?.status).toBe('ok');
        expect(requests).toStrictEqual([]);
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(removed);
    },
    PLANTED_TIMEOUT_MS,
);

test.each(['malformed', 'crashed'])(
    'verified-secret history redacts %s tool output and accepts corrected execution',
    async (failure) => {
        await using sandbox = await testdir();
        await using launcher = await testdir();
        await using verifier = await createSecretVerifier(launcher.path);
        const { firstToken, secondToken, requests, mode } = verifier;
        const { base, good, removed } = await prepareSecretHistory(sandbox.path, {
            'first.txt': firstToken,
            'second.txt': secondToken,
        });
        const command = [process.execPath, gspot, 'check', '--push', '--only', 'secrets/trufflehog', '--json'];
        const options = {
            cwd: sandbox.path,
            env: { PATH: `${launcher.path}${delimiter}${toolsPath(['trufflehog'])}` },
        };
        const input = `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/removed ${removed} refs/heads/removed ${base}\n`;
        writeFileSync(mode, failure);
        const broken = await runProcess(command, { ...options, stdin: input });
        expect(broken.code, broken.stdout + broken.stderr).toBe(2);
        expect(pushReportSchema.parse(JSON.parse(broken.stdout)).revisions[0]?.report.checks[0]?.status).toBe('error');
        for (const token of [firstToken, secondToken]) expect(broken.stdout + broken.stderr).not.toContain(token);
        writeFileSync(mode, 'native');
        requests.length = 0;
        const corrected = await runProcess(command, {
            ...options,
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(pushReportSchema.parse(JSON.parse(corrected.stdout)).revisions[0]?.report.checks[0]?.status).toBe('ok');
        expect(requests).toStrictEqual([]);
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(removed);
    },
    PLANTED_TIMEOUT_MS,
);
