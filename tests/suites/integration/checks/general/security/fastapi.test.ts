import { test, expect, describe } from 'bun:test';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { runAppliedSample } from '#tests/setup/cli/samples.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

import {
    FASTAPI_SOURCE,
    FASTAPI_CONFIGURATION_CASES,
} from '#tests/config/integration/checks/general/security/fastapi.ts';
import {
    SEMGREP_CHECK,
    SEMGREP_SANDBOX,
    SEMGREP_PROJECT_FILES,
} from '#tests/config/integration/checks/general/security/sandbox.ts';

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);
    test('the FastAPI rules report exception text in a response and accept a fixed detail', async () => {
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['fastapi', 'security']),
            'pyproject.toml': SEMGREP_PROJECT_FILES['pyproject.toml'],
            'service.py': FASTAPI_SOURCE,
            'neighbor.py':
                'from fastapi import HTTPException\nraise HTTPException(status_code=404, detail="User not found")\n',
        };
        await using sample = await runAppliedSample(
            installedSandbox(),
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
            {
                commandArguments: SEMGREP_CHECK,
                corrected: {
                    'service.py': FASTAPI_SOURCE.replace('detail=str(error)', 'detail="Unable to load user"'),
                },
            },
        );
        const { failed, passed: corrected } = sample;
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(listFindingRows(failed.report)).toStrictEqual([
            { file: 'service.py', line: 7, rule: 'gspot.fastapi.exception-text-in-response' },
        ]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    });
    test.each([...FASTAPI_CONFIGURATION_CASES])(
        'fastapi $rule reports unsafe input and accepts its fix',
        async ({ rule, source, fixed }) => {
            const files = {
                'gspot.toml': buildSandboxSettings(['fastapi', 'security']),
                'source.py': source,
            };
            await using sample = await runAppliedSample(
                installedSandbox(),
                buildSandboxChanges(SEMGREP_SANDBOX.files, files),
                {
                    commandArguments: SEMGREP_CHECK,
                    corrected: { 'source.py': fixed },
                },
            );
            expect(listFindingRows(sample.failed.report)).toStrictEqual([
                { file: 'source.py', line: 1, rule: `gspot.fastapi.${rule}` },
            ]);
            expect(sample.passed.code, sample.passed.stdout + sample.passed.stderr).toBe(0);
        },
    );
});
