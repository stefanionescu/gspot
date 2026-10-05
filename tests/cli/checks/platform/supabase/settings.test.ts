// The built-in Supabase checks on a test project, run in-process: each fires on its defect and accepts the correction.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';

import {
    CASES,
    REPOSITORY,
    TEST_PATH_FILES,
    TEST_PATH_POLICY,
} from '#tests/config/cli/checks/platform/supabase/settings.ts';

describe('the built-in supabase checks', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(REPOSITORY, runGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, REPOSITORY);
                expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                expect(outcome.report.checks[0]?.findings).toContainEqual(
                    containing({ check: entry.check, ...entry.expected }),
                );
                expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
                expect(correction.report.checks).toMatchObject([
                    { check: entry.check, status: 'passed', findings: [] },
                ]);
            },
            suiteTimeout(),
        );
    }
});

test('service role keys use effective test paths while adjacent client files still fail', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TEST_PATH_POLICY, ...TEST_PATH_FILES });
    const result = await runGspot(sandbox.path, ['check', '--only', 'supabase/admin-key', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'client.ts', rule: 'admin-key' },
        { file: 'apps/web/client.ts', rule: 'admin-key' },
    ]);
});

test('service role keys are refused in component and module clients while allowed server files remain untouched', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['supabase'], { tables: '[supabase]\nadmin_key_files = ["server/**"]\n' });
    const sources = {
        'client.vue': '<script setup>const key = process.env.SUPABASE_SERVICE_ROLE_KEY;</script>\n',
        'client.svelte': '<script>const key = process.env.SUPABASE_SERVICE_ROLE_KEY;</script>\n',
        'client.astro': '---\nconst key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n---\n',
        'client.mts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'client.cts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'client.cjs': 'exports.key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'server/allowed.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'notes.txt': 'SUPABASE_SERVICE_ROLE_KEY\n',
    };
    await createFileTree(sandbox.path, { 'gspot.toml': policy, ...sources });
    const result = await runGspot(sandbox.path, ['check', '--only', 'supabase/admin-key', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual([
        'client.astro',
        'client.cjs',
        'client.cts',
        'client.mts',
        'client.svelte',
        'client.vue',
    ]);
    for (const [path, text] of Object.entries(sources)) {
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(text);
        if (path.startsWith('client.'))
            await Bun.write(
                join(sandbox.path, path),
                text.replaceAll('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'),
            );
    }
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'supabase/admin-key', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks[0]?.findings).toStrictEqual([]);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(readFileSync(join(sandbox.path, 'server/allowed.ts'), 'utf8')).toBe(sources['server/allowed.ts']);
});
