import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { MISSING_OPENAPI_FINDINGS } from '#tests/config/checks/generator-outputs.ts';

test('a missing OpenAPI document is reported before generation', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['openapi'], {
            tables: '[openapi]\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n',
        }),
        'generate.ts': '',
    });

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'openapi/stale-document');
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    const missingResult = await runCheckCode(session, input, findCheckCode(input.check));
    expect(missingResult.findings).toMatchObject([...MISSING_OPENAPI_FINDINGS]);
    expect(run).not.toHaveBeenCalled();
});
