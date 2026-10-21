import { test, expect, describe } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system.ts';
import { listFindingRows } from '#tests/setup/run-gspot.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runAppliedSample } from '#tests/setup/sample-checks.ts';

import {
    SEMGREP_CHECK,
    FASTAPI_SOURCE,
    SEMGREP_SANDBOX,
    SEMGREP_PROJECT_FILES,
} from '#tests/data/checks/security/semgrep-rules.ts';

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = registerSharedSandbox(SEMGREP_SANDBOX);
    test('the FastAPI pack reports exception responses and accepts a stable replacement', async () => {
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
