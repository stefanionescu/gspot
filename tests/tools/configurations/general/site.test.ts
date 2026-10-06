// Test repository for the site configuration: a small site with a build script, broken one way for each check.
import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { install } from '#tests/harness/install.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { suiteTimeout, openTestBudget, runTestCommand } from '#tests/harness/command.ts';
import { CASES, COMMAND, REPOSITORY } from '#tests/config/tools/configurations/general/site.ts';

describe('the site configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(REPOSITORY, spawnGspot));
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

    test(
        'the default check inspects the built site without selecting external links',
        async () => {
            const { root, environment } = testRepository;
            const checked = await spawnGspot(root, ['check', '--json'], environment, {
                timeoutMs: NATIVE_TEST_TIMEOUT_MS,
            });
            expect(checked.code, checked.stdout + checked.stderr).toBe(0);
            const report = JSON.parse(checked.stdout) as RunReport;
            expect(report.checks.map(({ check }) => check)).not.toContain('site/linkinator-external');
            expect(report.checks).toContainEqual(containing({ check: 'site/build', status: 'passed' }));
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});

// Recommended savings thresholds and strict optimization both accept corrected bytes.
async function expectSvgThresholds(root: string, svg: string): Promise<void> {
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const small = await spawnGspot(root, COMMAND);
    expect(small.code, small.stdout + small.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg + ' '.repeat(Buffer.byteLength(svg)));
    const large = await spawnGspot(root, COMMAND);
    expect(large.code, large.stdout + large.stderr).toBe(1);
    expect((JSON.parse(large.stdout) as RunReport).checks[0]!.findings).toStrictEqual([
        containing({ file: 'icon.svg', rule: 'unoptimized' }),
    ]);
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const configured = await spawnGspot(root, ['set', 'level', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const strict = await spawnGspot(root, COMMAND);
    expect(strict.code, strict.stdout + strict.stderr).toBe(1);
    const relaxed = await spawnGspot(root, [
        'set',
        'tools.svgo.min_saving_percent',
        '100',
        '--reason',
        'Required optimization threshold for generated SVG assets.',
    ]);
    expect(relaxed.code, relaxed.stdout + relaxed.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg + ' '.repeat(Buffer.byteLength(svg)));
    const allowed = await spawnGspot(root, COMMAND);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    const tightened = await spawnGspot(root, ['set', 'tools.svgo.min_saving_percent', '0']);
    expect(tightened.code, tightened.stdout + tightened.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const restored = await spawnGspot(root, COMMAND);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    await Bun.write(join(root, 'icon.svg'), svg);
    const corrected = await spawnGspot(root, COMMAND);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'site/svgo', status: 'passed', fileCount: 1, findings: [] },
    ]);
}

// Explicit file selection excludes malformed neighbors, which fail when selected.
async function expectSvgSelection(root: string, svg: string): Promise<void> {
    const configured = await spawnGspot(root, ['set', 'level', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg);
    await Bun.write(join(root, 'other.svg'), '<svg><broken>');
    // A path goes before --only, which takes every word up to the next command option.
    const selected = await spawnGspot(root, ['check', 'icon.svg', ...COMMAND.slice(1)]);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const malformed = await spawnGspot(root, COMMAND);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect((JSON.parse(malformed.stdout) as RunReport).checks[0]!.status).toBe('error');
    await Bun.write(join(root, 'other.svg'), svg);
    const repaired = await spawnGspot(root, COMMAND);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    expect((JSON.parse(repaired.stdout) as RunReport).checks).toMatchObject([
        { check: 'site/svgo', status: 'passed', fileCount: 2, findings: [] },
    ]);
}

test(
    'native SVG optimization enforces both level thresholds and explicit file selection',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>\n',
        });
        await install(root, buildInitArguments(['site']), {});
        const native = await runTestCommand(
            [join(root, '.gspot/node_modules/.bin/svgo'), '--input', 'icon.svg', '--output', '-'],
            { cwd: root },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        await expectSvgThresholds(root, native.stdout);
        await expectSvgSelection(root, native.stdout);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
