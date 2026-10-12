import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { SEMGREP_CHECK } from '#tests/config/execution.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { FASTAPI_SOURCE } from '#tests/config/python/modules.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import { SEMGREP_PROJECT_FILES } from '#tests/config/security.ts';
import { spawnGspot, findingRows } from '#tests/setup/run-gspot.ts';

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))(
    'the FastAPI pack reports exception responses and accepts a stable replacement',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['fastapi', 'security']),
            'pyproject.toml': SEMGREP_PROJECT_FILES['pyproject.toml'],
            'service.py': FASTAPI_SOURCE,
            'neighbor.py':
                'from fastapi import HTTPException\nraise HTTPException(status_code=404, detail="User not found")\n',
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installToolProjects(sandbox.path);
        const failed = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(findingRows(JSON.parse(failed.stdout) as RunReport)).toStrictEqual([
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
