import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { reportSchema } from '#cli/schemas/reports.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

test(
    'levels preserve defect checks and require an explicit opt-in for naming preferences',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["bash", "naming"]\n[rules]\ninstall = false\n',
            'entry.sh': 'shell_command=example\n',
        });
        const command = ['check', '--only', 'bash/syntax', 'naming/identifiers', '--no-cache', '--json'];
        const recommended = await run(sandbox.path, command);
        expect(recommended.code, recommended.stdout + recommended.stderr).toBe(0);
        const report = reportSchema.parse(JSON.parse(recommended.stdout));
        expect(report.skips).toStrictEqual([]);
        expect(report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
            { check: 'bash/syntax', status: 'ok' },
        ]);
        await Bun.write(join(sandbox.path, 'entry.sh'), 'if then\n');
        const invalid = await run(sandbox.path, command);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(invalid.stdout)).checks[0]).toMatchObject({
            check: 'bash/syntax',
            status: 'fail',
            files: 1,
        });
        await Bun.write(join(sandbox.path, 'entry.sh'), 'shell_command=example\n');
        const all = await run(sandbox.path, ['set', 'level', 'all']);
        expect(all.code, all.stdout + all.stderr).toBe(0);
        const strict = await run(sandbox.path, command);
        expect(strict.code, strict.stdout + strict.stderr).toBe(1);
        const strictReport = reportSchema.parse(JSON.parse(strict.stdout));
        expect(strictReport.skips).toStrictEqual([]);
        expect(strictReport.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
            { check: 'bash/syntax', status: 'ok' },
            { check: 'naming/identifiers', status: 'fail' },
        ]);
        expect(strictReport.checks[1]!.findings).toHaveLength(1);
        expect(strictReport.checks[1]!.findings[0]).toMatchObject({
            check: 'naming/identifiers',
            file: 'entry.sh',
            line: 1,
            rule: 'banned-term',
        });
        const allowed = await run(sandbox.path, [
            'set',
            'naming.allowed',
            '{"name":"shell_command"}',
            '--reason',
            'External protocol fixes this name',
        ]);
        expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
        const accepted = await run(sandbox.path, command);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(accepted.stdout)).checks[1]?.findings).toStrictEqual([]);
        const removed = await run(sandbox.path, ['set', 'naming.allowed', 'shell_command', '--remove']);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        const restored = await run(sandbox.path, command);
        expect(restored.code, restored.stdout + restored.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(restored.stdout)).checks[1]?.findings[0]?.rule).toBe('banned-term');
        const obsolete = await run(sandbox.path, ['allow', 'naming', 'shell_command']);
        expect(obsolete.code).toBe(2);
        const reset = await run(sandbox.path, ['set', 'level', '--default']);
        expect(reset.code, reset.stdout + reset.stderr).toBe(0);
        const extra = await run(sandbox.path, ['set', 'extra_checks', 'naming/identifiers']);
        expect(extra.code, extra.stdout + extra.stderr).toBe(0);
        const optedIn = await run(sandbox.path, command);
        expect(optedIn.code, optedIn.stdout + optedIn.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(optedIn.stdout)).checks[1]?.status).toBe('fail');
        await Bun.write(join(sandbox.path, 'entry.sh'), 'command=example\n');
        const corrected = await run(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks.every((check) => check.status === 'ok')).toBe(
            true,
        );
        const policyPath = join(sandbox.path, 'gspot.toml');
        const before = await Bun.file(policyPath).text();
        for (const args of [
            ['level', 'strict'],
            ['extra_checks', 'unknown/check'],
        ]) {
            const refused = await run(sandbox.path, ['set', ...args]);
            expect(refused.code, refused.stdout + refused.stderr).toBe(2);
            expect(await Bun.file(policyPath).text()).toBe(before);
        }
    },
    PLANTED_TIMEOUT_MS,
);
