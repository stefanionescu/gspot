import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getBuiltInCheck, prepareSwiftCheck } from '#tests/setup/cli/checks.ts';
import { planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { ANALYZER_EXIT_CASES, UNEXPECTED_PLAN_MESSAGE } from '#tests/config/configurations/swift.ts';

test.each([...ANALYZER_EXIT_CASES])(
    'analyzer: build exit $buildCode and analyzer exit $analyzerCode report the failed stage',
    async ({ buildCode, analyzerCode, message }) => {
        await using sandbox = await createGitSandbox({});
        await using resources = new AsyncDisposableStack();
        await using prepared = await prepareSwiftCheck(sandbox, 'swift/swiftlint-analyze');
        resources.use(
            spyOn(processes, 'spawnProcess')
                .mockResolvedValueOnce(buildProcessResult({ code: buildCode }))
                .mockResolvedValue(buildProcessResult({ code: analyzerCode })),
        );
        const rejection = await captureRejection(
            getBuiltInCheck('swift/swiftlint-analyze')(prepared.session, prepared.planned),
        );
        expect(rejection.message).toBe(message);
    },
);

test('analyzer: swift/swiftlint-analyze removes its own old compiler files and leaves the incremental build of swift/build in place', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/swiftlint-analyze');

    const input = prepared.planned;
    const compile = planSwiftBuild(prepared.session, input);
    const analyzer = planSwiftBuild(prepared.session, input, 'analyze');
    if (analyzer.kind !== 'package') throw new Error(UNEXPECTED_PLAN_MESSAGE);
    const compilerState = join(compile.folder, 'package', 'state');
    const analyzerState = join(analyzer.scratch, 'state');
    await mkdir(join(compile.folder, 'package'), { recursive: true });
    await mkdir(analyzer.scratch, { recursive: true });
    await writeFile(compilerState, 'incremental');
    await writeFile(analyzerState, 'old analyzer');
    resources.use(
        spyOn(processes, 'spawnProcess')
            .mockResolvedValueOnce(buildProcessResult({ stdout: 'incremental log' }))
            .mockResolvedValueOnce(buildProcessResult({ stdout: 'complete compiler log' }))
            .mockResolvedValue(buildProcessResult()),
    );

    expect(await getBuiltInCheck('swift/build')(prepared.session, input)).toStrictEqual([]);
    expect(await getBuiltInCheck('swift/swiftlint-analyze')(prepared.session, input)).toStrictEqual([]);
    expect(await readFile(compilerState, 'utf8')).toBe('incremental');
    expect(await isOnDisk(analyzerState)).toBe(false);
    expect(await readFile(analyzer.log, 'utf8')).toBe('complete compiler log\n');
    expect(await readFile(compile.log, 'utf8')).toBe('incremental log\n');
});
