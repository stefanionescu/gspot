import { join, relative } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { executableLayout } from '#cli/system/paths.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { fakeNpmTool, writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { SAMPLE_PYPROJECT, LOCKED_PACKAGE_CASES, LICENSE_PACKAGE_JSON } from '#tests/config/checks/general/licenses.ts';

test.each([...LOCKED_PACKAGE_CASES])(
    'licenses/allowed reads only the packages that $name locks',
    async ({ file, text, expected }) => {
        const python = file === 'uv.lock';
        const manifest = python ? 'pyproject.toml' : 'package.json';
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n' }),
            [manifest]: python ? SAMPLE_PYPROJECT : LICENSE_PACKAGE_JSON,
            [python ? '.venv/installed' : 'node_modules/installed']: 'installed',
            [file]: text,
        });
        if (python) {
            const tool = getTool(readConfigurations().values(), 'pip-licenses');
            const path = relative(
                sandbox.path,
                join(sandbox.path, GSPOT_PATHS.pythonEnvironment, executableLayout.environmentFolder, 'pip-licenses'),
            );
            await writeProgramCommand(sandbox.path, path, 'fakes/tool', '--line', `pip-licenses ${tool.version!}`);
        } else await fakeNpmTool(sandbox.path, 'license-checker-rseidelsohn');
        const installed = [...expected, 'unlocked@9.9.9'];
        const stdout = python
            ? installed.map((identity) => {
                  const separator = identity.lastIndexOf('@');
                  return {
                      Name: identity.slice(0, separator),
                      Version: identity.slice(separator + 1),
                      'License-Expression': 'GPL-3.0-only',
                  };
              })
            : Object.fromEntries(installed.map((identity) => [identity, { licenses: 'GPL-3.0-only' }]));
        using _scan = spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ stdout: JSON.stringify(stdout) }),
        );
        const findings = await runSandboxCheck(sandbox.path, 'licenses/allowed');
        expect(findings.map(({ file: path, rule, message }) => ({ file: path, rule, message }))).toStrictEqual(
            expected.map((identity) => ({
                file: manifest,
                rule: 'disallowed-license',
                message: `${identity} uses GPL-3.0-only, which is not allowed.`,
            })),
        );
    },
);

test.each(['root', 'nearest', 'none'])(
    'licenses/allowed reads the %s lockfile for a nested project',
    async (location) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['licenses'], {
                tables: '[licenses]\nallowed = ["MIT"]\n',
                scopes: [{ path: 'apps/web' }],
            }),
            'apps/web/package.json': LICENSE_PACKAGE_JSON,
            'apps/web/node_modules/installed': 'installed',
        });
        if (location !== 'none')
            await createFileTree(sandbox.path, {
                'bun.lock': '{"packages":{"root":["root@1.0.0"]}}',
                ...(location === 'nearest' ? { 'apps/bun.lock': '{"packages":{"nearest":["nearest@1.0.0"]}}' } : {}),
            });
        await fakeNpmTool(sandbox.path, 'license-checker-rseidelsohn');
        using _scan = spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({
                stdout: JSON.stringify({
                    'root@1.0.0': { licenses: 'GPL-3.0-only' },
                    'nearest@1.0.0': { licenses: 'GPL-3.0-only' },
                }),
            }),
        );
        const findings = await runSandboxCheck(sandbox.path, 'licenses/allowed');
        expect(findings.map(({ message }) => message)).toStrictEqual(
            location === 'none'
                ? [
                      'root@1.0.0 uses GPL-3.0-only, which is not allowed.',
                      'nearest@1.0.0 uses GPL-3.0-only, which is not allowed.',
                  ]
                : [`${location}@1.0.0 uses GPL-3.0-only, which is not allowed.`],
        );
    },
);
