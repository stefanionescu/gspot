import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
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
            spyOn(processes, 'runProcess')
                .mockResolvedValueOnce(buildProcessResult({ code: buildCode }))
                .mockResolvedValue(buildProcessResult({ code: analyzerCode })),
        );
        const rejection = await captureRejection(
            getBuiltInCheck('swift/swiftlint-analyze')(prepared.session, prepared.planned),
        );
        expect(rejection.message).toBe(message);
    },
);

test('analyzer: swift/swiftlint-analyze removes the old compiler files, so its compiler log lists every file', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/swiftlint-analyze');

    const input = prepared.planned;
    const plan = planSwiftBuild(prepared.session, input);
    if (plan.kind !== 'package') throw new Error(UNEXPECTED_PLAN_MESSAGE);
    const compilerState = join(plan.scratch, 'state');
    await mkdir(plan.scratch, { recursive: true });
    await writeFile(compilerState, 'incremental');
    resources.use(
        spyOn(processes, 'runProcess')
            .mockResolvedValueOnce(buildProcessResult({ stdout: 'complete compiler log' }))
            .mockResolvedValue(buildProcessResult()),
    );

    expect(await getBuiltInCheck('swift/swiftlint-analyze')(prepared.session, input)).toStrictEqual([]);
    expect(existsSync(compilerState)).toBe(false);
    expect(await readFile(plan.log, 'utf8')).toBe('complete compiler log\n');
});
