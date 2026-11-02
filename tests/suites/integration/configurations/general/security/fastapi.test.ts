import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { writeSandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

import {
    SEMGREP_CHECK,
    FASTAPI_SOURCE,
    SEMGREP_CHECK_ID,
    FASTAPI_PROJECT,
    SEMGREP_SANDBOX,
    FASTAPI_SCOPE_SETTINGS,
    FASTAPI_CONFIGURATION_CASES,
} from '#tests/config/integration/semgrep.ts';

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);
    test('the FastAPI rules report exception text in a response and accept a fixed detail', async () => {
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['fastapi', 'security']),
            'pyproject.toml': FASTAPI_PROJECT,
            'service.py': FASTAPI_SOURCE,
            'neighbor.py':
                'from fastapi import HTTPException\nraise HTTPException(status_code=404, detail="User not found")\n',
        };
        await assertCheckSample(installedSandbox(), {
            ...buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
            check: SEMGREP_CHECK_ID,
            apply: true,
            expected: { file: 'service.py', line: 7, rule: 'gspot.fastapi.exception-text-in-response' },
            corrected: {
                files: {
                    ...sourceFiles,
                    'service.py': FASTAPI_SOURCE.replace('detail=str(error)', 'detail="Unable to load user"'),
                },
            },
        });
    });
    test.each([...FASTAPI_CONFIGURATION_CASES])(
        'fastapi $rule reports unsafe input and accepts its fix',
        async ({ rule, source, fixed }) => {
            const files = {
                'gspot.toml': buildSandboxSettings(['fastapi', 'security']),
                'source.py': source,
            };
            await assertCheckSample(installedSandbox(), {
                ...buildSandboxChanges(SEMGREP_SANDBOX.files, files),
                check: SEMGREP_CHECK_ID,
                apply: true,
                expected: { file: 'source.py', line: 1, rule: `gspot.fastapi.${rule}` },
                corrected: { files: { ...files, 'source.py': fixed } },
            });
        },
    );
});

describe.skipIf(!hasToolBuild('semgrep'))('semgrep rule files', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);

    test('a broken rule file is an error in the scopes that read it', async () => {
        const { root } = installedSandbox();
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['python', 'security'], { tables: FASTAPI_SCOPE_SETTINGS }),
            'app/pyproject.toml': FASTAPI_PROJECT,
            'app/service.py': FASTAPI_SOURCE,
            'app/child/service.py': FASTAPI_SOURCE,
            'sibling/service.py': 'PORT = 8080\n',
        };
        await using _sourceChange = await writeSandboxChanges(
            installedSandbox(),
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
        );
        await writeFile(join(root, getManifestTarget('fastapi', 'semgrep.yml')), 'rules: [');
        const invalid = parseCheckReport(await spawnGspot(root, SEMGREP_CHECK));
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(
            invalid.report.checks.filter(({ status }) => status === 'error').map(({ scope }) => scope),
        ).toStrictEqual(['app', 'app/child']);
    });
});
