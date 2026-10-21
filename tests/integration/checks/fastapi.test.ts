import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { hasToolBuild } from '#tests/setup/system.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/run-gspot.ts';

import {
    SEMGREP_CHECK,
    FASTAPI_SOURCE,
    SEMGREP_PROJECT_FILES,
    CHECKS_FASTAPI_INSTALLED_SANDBOX,
} from '#tests/data/checks/security/semgrep-rules.ts';

// Systems without a semgrep build skip every test here, so they install nothing.
const installedSandbox = hasToolBuild('semgrep') ? registerSharedSandbox(CHECKS_FASTAPI_INSTALLED_SANDBOX) : undefined;

test.skipIf(!hasToolBuild('semgrep'))(
    'the FastAPI pack reports exception responses and accepts a stable replacement',
    async () => {
        const sandbox = { path: installedSandbox!().root };
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['fastapi', 'security']),
            'pyproject.toml': SEMGREP_PROJECT_FILES['pyproject.toml'],
            'service.py': FASTAPI_SOURCE,
            'neighbor.py':
                'from fastapi import HTTPException\nraise HTTPException(status_code=404, detail="User not found")\n',
        };
        await using _sourceChange = await applySandboxChanges(installedSandbox!(), {
            check: '',
            files: sourceFiles,
            removed: Object.keys(CHECKS_FASTAPI_INSTALLED_SANDBOX.files).filter(
                (path) => path !== '.gitignore' && !Object.hasOwn(sourceFiles, path),
            ),
        });
        const failed = parseCheckReport(await spawnGspot(sandbox.path, SEMGREP_CHECK));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(listFindingRows(failed.report)).toStrictEqual([
            { file: 'service.py', line: 7, rule: 'gspot.fastapi.exception-text-in-response' },
        ]);
        await writeFile(
            join(sandbox.path, 'service.py'),
            FASTAPI_SOURCE.replace('detail=str(error)', 'detail="Unable to load user"'),
        );
        const corrected = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
