import { test, spyOn, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import * as processes from '#cli/system/processes.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { CHECK_GENERATION } from '#tests/setup/cli/run.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCheckCode, buildCheckSession } from '#cli/engine/run.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { checkGeneratorOutputs } from '#cli/configurations/generator-outputs.ts';
import { MISSING_OPENAPI_FINDINGS } from '#tests/config/checks/cross-configuration/generator-outputs.ts';

test('a missing OpenAPI document is reported before generation', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['openapi'], {
            tables: '[openapi]\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n',
        }),
        'generate.ts': '',
    });

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'openapi/stale-document');
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    const missingResult = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        input,
        input.check.generator_outputs === undefined ? CHECK_CODE[input.check.id] : { check: checkGeneratorOutputs },
        {},
    );
    expect(missingResult.findings).toStrictEqual(MISSING_OPENAPI_FINDINGS.map((finding) => matchFields(finding)));
    expect(run).not.toHaveBeenCalled();
});
