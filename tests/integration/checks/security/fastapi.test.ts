import { test, expect, describe } from 'bun:test';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { runAppliedSample } from '#tests/setup/cli/samples.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { FASTAPI_SOURCE } from '#tests/data/integration/checks/security/fastapi.ts';

import {
    SEMGREP_CHECK,
    SEMGREP_SANDBOX,
    SEMGREP_PROJECT_FILES,
} from '#tests/data/integration/checks/security/semgrep.ts';

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);
    test('the FastAPI Semgrep rules report exception text in a response and accept a fixed detail', async () => {
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
});
