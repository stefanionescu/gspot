import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { mkdirSync, symlinkSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { isMacos } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { BATS_MINIMUM_FILES } from '#tests/config/tools/checks/bats-minimum.ts';

test.skipIf(!isMacos).each(['recommended', 'all'] as const)(
    '%s allows syntax checks on stock macOS Bash and reports the Bats version prerequisite',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...BATS_MINIMUM_FILES,
            'gspot.toml': buildPolicy(['bash'], { level }),
        });
        const bin = join(sandbox.path, 'bin');
        mkdirSync(bin);
        symlinkSync('/bin/bash', join(bin, 'bash'));
        const available = { PATH: buildToolsPath(['bats']) };
        const stock = { PATH: `${bin}${delimiter}${available.PATH}` };
        const applied = await spawnGspot(sandbox.path, ['apply'], stock);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const syntax = await spawnGspot(sandbox.path, ['check', '--only', 'bash/syntax', '--json'], stock);
        expect(syntax.code, syntax.stdout + syntax.stderr).toBe(0);
        expect((JSON.parse(syntax.stdout) as RunReport).checks).toMatchObject([
            { check: 'bash/syntax', status: 'passed', fileCount: 1, findings: [] },
        ]);
        const blocked = await spawnGspot(sandbox.path, ['check', '--only', 'bash/bats', '--json'], stock);
        expect(blocked.code, blocked.stdout + blocked.stderr).toBe(2);
        const requirement = (JSON.parse(blocked.stdout) as RunReport).checks[0];
        expect(requirement).toMatchObject({ check: 'bash/bats', status: 'missing', findings: [] });
        expect(requirement?.note).toContain('bash');
        expect(requirement?.note).toContain('4.4.0');
        const doctor = await spawnGspot(sandbox.path, ['doctor', '--json'], stock);
        expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
        expect((JSON.parse(doctor.stdout) as DoctorReport).tools.find((tool) => tool.name === 'bash')).toMatchObject({
            state: 'outdated',
            found: '3.2.57',
            floor: '4.4.0',
        });
        const parsed = await spawnGspot(sandbox.path, ['check', '--only', 'bash/bats', '--json'], available);
        expect(parsed.code, parsed.stdout + parsed.stderr).toBe(1);
        expect((JSON.parse(parsed.stdout) as RunReport).checks[0]?.findings).toMatchObject([
            { file: 'script.bats', line: 2 },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
