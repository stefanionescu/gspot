import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';

test.each(['recommended', 'all'])(
    'blocking calls at %s belong to each async body, excluding synchronous closures',
    async (level) => {
        await using sandbox = await testdir();
        const source = [
            'import asyncio',
            'import time',
            'async def route():',
            '    time.sleep(1)',
            '    def worker():',
            '        time.sleep(1)',
            '    callback = lambda: time.sleep(1)',
            '    async def nested():',
            '        time.sleep(2)',
        ].join('\n');
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["fastapi"]\n`,
            'routes.py': source,
        });
        const options = {
            stage: 'all' as const,
            skips: [],
            only: ['fastapi/no-blocking-io-in-async'],
            noCache: true,
            fix: false,
            isDryRun: true,
        };
        const failed = await executeRun(await openSession(sandbox.path), options);
        expect(failed.report.exitCode).toBe(1);
        expect(
            failed.report.checks.flatMap(({ findings }) =>
                findings.map(({ file, line, rule }) => ({ file, line, rule })),
            ),
        ).toStrictEqual([
            { file: 'routes.py', line: 4, rule: 'blocking-call' },
            { file: 'routes.py', line: 9, rule: 'blocking-call' },
        ]);
        await Bun.write(
            `${sandbox.path}/routes.py`,
            source
                .replace('    time.sleep(1)\n', '    await asyncio.sleep(1)\n')
                .replace('time.sleep(2)', 'await asyncio.sleep(2)'),
        );
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'ok', findings: [] }]);
    },
);
