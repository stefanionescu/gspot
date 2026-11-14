import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { hasToolBuild } from '#tests/setup/cli/tools.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SEMGREP_SANDBOX } from '#tests/config/integration/general.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { buildSandboxChanges, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

const FASTAPI_PROJECT = `[project]
name = "example"
version = "1.0.0"
dependencies = ["fastapi"]
`;

const FASTAPI_SCOPE_SETTINGS = `[[scope]]
path = "app"
configurations = ["fastapi"]

[[scope]]
path = "app/child"

[[scope]]
path = "sibling"
`;

const FASTAPI_SOURCE = `from fastapi import HTTPException

def lookup():
    try:
        return load_user()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
`;

const FASTAPI_CONFIGURATION_CASES = [
    {
        rule: 'cors-wildcard-with-credentials',
        source: 'app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True)\n',
        fixed: 'app.add_middleware(CORSMiddleware, allow_origins=["https://example.test"], allow_credentials=True)\n',
    },
    { rule: 'debug-enabled', source: 'app = FastAPI(debug=True)\n', fixed: 'app = FastAPI(debug=False)\n' },
] as const;

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);
    test('the FastAPI rules report exception text, a CORS wildcard with credentials, and debug mode, and accept their fixes', async () => {
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['fastapi', 'security']),
            'pyproject.toml': FASTAPI_PROJECT,
            'service.py': FASTAPI_SOURCE,
            'neighbor.py':
                'from fastapi import HTTPException\nraise HTTPException(status_code=404, detail="User not found")\n',
        };
        const unsafe = FASTAPI_CONFIGURATION_CASES.map(({ rule, source }): [string, string] => [`${rule}.py`, source]);
        const fixed = FASTAPI_CONFIGURATION_CASES.map(({ rule, fixed: source }): [string, string] => [
            `${rule}.py`,
            source,
        ]);
        const files = { ...sourceFiles, ...Object.fromEntries(unsafe) };
        const findings = [
            ...FASTAPI_CONFIGURATION_CASES.map(({ rule }) => ({
                file: `${rule}.py`,
                line: 1,
                rule: `gspot.fastapi.${rule}`,
            })),
            { file: 'service.py', line: 7, rule: 'gspot.fastapi.exception-text-in-response' },
        ];
        await assertCheckSample(installedSandbox(), {
            ...buildSandboxChanges(SEMGREP_SANDBOX.files, files),
            check: 'security/semgrep',
            apply: true,
            expected: findings[0]!,
            findings,
            corrected: {
                files: {
                    ...files,
                    ...Object.fromEntries(fixed),
                    'service.py': FASTAPI_SOURCE.replace('detail=str(error)', 'detail="Unable to load user"'),
                },
            },
        });
    });

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
        const invalid = parseCheckReport(await spawnGspot(root, ['check', '--only', 'security/semgrep', '--json']));
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(
            invalid.report.checks.filter(({ status }) => status === 'error').map(({ scope }) => scope),
        ).toStrictEqual(['app', 'app/child']);
    });
});
