import { expect, spyOn, test } from 'bun:test';

import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildCheckSession, runCheckCode } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/check-generation.ts';
import * as processes from '#cli/system/processes.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const MISSING_OPENAPI_FINDINGS = [
    {
        file: 'openapi.json',
        line: 1,
        rule: 'missing',
        message: 'The file openapi.json does not exist; run bun generate.ts and commit what it writes.',
    },
] as const;

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
    const run = resources.use(spyOn(processes, 'runProcess'));
    const missingResult = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        input,
        selectCheckCode(input.check),
        {},
    );
    expect(missingResult.findings).toStrictEqual(MISSING_OPENAPI_FINDINGS.map((finding) => matchFields(finding)));
    expect(run).not.toHaveBeenCalled();
});
