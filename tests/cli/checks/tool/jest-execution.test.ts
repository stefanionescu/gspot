import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { parseManifest } from '#cli/configurations/public.ts';
import { coverageArguments } from '#cli/planning/contracts.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { SAMPLE, OUTCOMES, ZERO_COMMANDS } from '#tests/config/cli/checks/tool/jest-execution.ts';

test.each(OUTCOMES)(
    'Jest command reports $name, disposes its source copy, and passes after the fix',
    async (outcome) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['jest']),
            'sample.test.cjs': SAMPLE,
            'node_modules/.bin/jest': '#!/usr/bin/env node\n',
        });
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'push', skips: [], only: ['jest/coverage'] })[0]!;
        let isBroken = true;
        const artifacts: string[] = [];
        using _spawn = spyOn(processes, 'run').mockImplementation(async (argv, options) => {
            expect(argv).not.toContain('--runInBand');
            artifacts.push(options.cwd);
            await Bun.write(join(options.cwd, 'sample.test.cjs'), 'temporary test output');
            return {
                code: isBroken ? outcome.code : 0,
                missing: false,
                stdout: '',
                stderr: isBroken ? outcome.stderr : '',
                duration: 1,
                isTimedOut: isBroken && outcome.isTimedOut,
                isCanceled: isBroken && outcome.isCanceled,
            };
        });
        const failed = await runCheckCommand(session, planned);
        expect(failed.status).toBe(outcome.status);
        if (outcome.note === undefined) {
            expect(failed.findings).toMatchObject([
                {
                    message: textContaining(
                        outcome.stderr.includes('threshold') ? 'coverage threshold for functions' : 'Expected: 2',
                    ),
                },
            ]);
        } else {
            expect(failed.note).toContain(outcome.note);
        }
        expect(artifacts.length).toBeGreaterThan(0);
        expect(await Promise.all(artifacts.map((path) => pathExists(path)))).toStrictEqual(artifacts.map(() => false));
        expect(await readFile(join(sandbox.path, 'sample.test.cjs'), 'utf8')).toBe(SAMPLE);
        isBroken = false;
        expect(await runCheckCommand(session, planned)).toMatchObject({ status: 'passed', findings: [] });
        expect(await Promise.all(artifacts.map((path) => pathExists(path)))).toStrictEqual(artifacts.map(() => false));
        expect(await readFile(join(sandbox.path, 'sample.test.cjs'), 'utf8')).toBe(SAMPLE);
    },
);

test.each(
    ['recommended', 'all'].flatMap((level) =>
        ['', 'app'].flatMap((scope) =>
            ['zero', 'lines', 'branches', 'functions', 'statements'].map((dimension) => ({ level, scope, dimension })),
        ),
    ),
)('$level "$scope" coverage uses the $dimension floor', async ({ level, scope, dimension }) => {
    await using sandbox = await testdir();
    const coverage = Object.fromEntries(
        ['lines', 'branches', 'functions', 'statements'].map((name) => [name, name === dimension ? 1 : 0]),
    );
    const reasons = Object.fromEntries(
        Object.keys(coverage).map((name) => [`coverage.${name}`, 'This scenario measures one floor at a time.']),
    );
    const choice = { configurations: ['jest', 'pytest', 'vitest'], coverage, reasons };
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({ level, ...choice, scope: { app: choice } }),
        'sample.test.cjs': SAMPLE,
        'app/sample.test.cjs': SAMPLE,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, {
        stage: 'push',
        skips: [],
        only: ['jest/coverage', 'pytest/coverage', 'vitest/coverage'],
    });
    for (const name of ['jest', 'pytest', 'vitest'] as const) {
        const planned = plans.find(
            (entry) => entry.scope.scope.path === scope && entry.check.name === `${name}/coverage`,
        )!;
        const command = planned.check.command!;
        const gated = coverageArguments(planned, {});
        if (dimension === 'zero') expect(gated).toStrictEqual(ZERO_COMMANDS[name]);
        else expect(gated).toBe(command);
    }
});

test('coverage gating leaves unrelated commands, authored checks, and supplied arguments unchanged', async () => {
    await using sandbox = await testdir();
    const command = [process.execPath, '--coverage', '', 'two words'];
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            check: { 'project/tests': { command, stage: 'push', paths: ['sample.test.cjs'] } },
        }),
        'sample.test.cjs': SAMPLE,
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'push', skips: [], only: ['project/tests'] })[0]!;
    using _spawn = spyOn(processes, 'run').mockImplementation((argv) => {
        expect(argv).toStrictEqual(command);
        return Promise.resolve({ code: 0, missing: false, stdout: '', stderr: '', duration: 1 });
    });
    const authored = await runCheckCommand(session, planned);
    const supplied = await runCheckCommand(session, planned, { command });
    expect(authored.status).toBe('passed');
    expect(supplied.status).toBe('passed');
    expect(coverageArguments(planned, { command: ['echo', '', 'two words'] })).toStrictEqual(['echo', '', 'two words']);
});

test('isolated scope commands require a root placeholder, including embedded native rootDir values', async () => {
    const text = await readFile(
        new URL('../../../../packages/cli/configurations/test/jest/manifest.toml', import.meta.url),
        'utf8',
    );
    expect(parseManifest(text, 'configurations/test/jest').checks[0]!.command).toContain('--rootDir={root}/{scope}');
    expect(() =>
        parseManifest(text.replace('--rootDir={root}/{scope}', '--rootDir=.'), 'configurations/test/jest'),
    ).toThrow('requires runs');
});
