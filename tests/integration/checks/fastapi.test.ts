import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { spawnGspot, listFindingRows } from '#tests/setup/run-gspot.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    SEMGREP_CHECK,
    FASTAPI_SOURCE,
    SEMGREP_PROJECT_FILES,
    CHECKS_FASTAPI_INSTALLED_SANDBOX,
} from '#tests/data/checks/security/semgrep-rules.ts';

const installedSandbox = registerSharedSandbox(CHECKS_FASTAPI_INSTALLED_SANDBOX);

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))(
    'the FastAPI pack reports exception responses and accepts a stable replacement',
    async () => {
        const sandbox = { path: installedSandbox().root };
        const sourceFiles = {
            'gspot.toml': buildSettingsText(['fastapi', 'security']),
            'pyproject.toml': SEMGREP_PROJECT_FILES['pyproject.toml'],
            'service.py': FASTAPI_SOURCE,
            'neighbor.py':
                'from fastapi import HTTPException\nraise HTTPException(status_code=404, detail="User not found")\n',
        };
        await using _sourceChange = await updateSandbox(installedSandbox(), {
            check: '',
            files: sourceFiles,
            removed: Object.keys(CHECKS_FASTAPI_INSTALLED_SANDBOX.files).filter(
                (path) => path !== '.gitignore' && !Object.hasOwn(sourceFiles, path),
            ),
        });
        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        const failed = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(listFindingRows(JSON.parse(failed.stdout) as RunReport)).toStrictEqual([
            { file: 'service.py', line: 7, rule: 'gspot.fastapi.exception-text-in-response' },
        ]);
        await Bun.write(
            join(sandbox.path, 'service.py'),
            FASTAPI_SOURCE.replace('detail=str(error)', 'detail="Unable to load user"'),
        );
        const corrected = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
