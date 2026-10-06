import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { HOOK_DOCTOR_TOOLS } from '#tests/config/tools/commands/doctor.ts';

test(
    'doctor fails hooks this clone does not run and accepts them once installed',
    async () => {
        await using sandbox = await testdir();
        // An empty hooks table enables the default Git hook integration.
        await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([], { tables: '[hooks]\n' }) });
        const environment = { PATH: buildToolsPath(HOOK_DOCTOR_TOOLS) };
        gitOutput(sandbox.path, ['init', '-q']);
        const missing = await spawnGspot(sandbox.path, ['doctor', '--json'], environment);
        expect(missing.code, missing.stdout + missing.stderr).toBe(1);
        expect((JSON.parse(missing.stdout) as DoctorReport).hooks).toContain('not installed; run gspot install');
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const installed = await spawnGspot(sandbox.path, ['install'], environment);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const diagnosed = await spawnGspot(sandbox.path, ['doctor', '--json'], environment);
        expect(diagnosed.code, diagnosed.stdout + diagnosed.stderr).toBe(0);
        const report = JSON.parse(diagnosed.stdout) as DoctorReport;
        expect(report.hooks).toContain('.gspot/hooks: installed');
        expect(report.tools.filter(({ state }) => state !== 'ok' && state !== 'host')).toStrictEqual([]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
