// Writes license test settings and scanner version commands.
import { createFileTree } from 'testdirs';
import { join, relative } from 'node:path';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { virtualEnvironmentBin } from '#cli/system/executables.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { ALLOWED_PACKAGE_SCOPE_CASES } from '#tests/config/licenses.ts';

import {
    LICENSE_SETTINGS,
    SAMPLE_PYPROJECT,
    ALLOWED_PACKAGE_ENTRY,
    ABSENT_PACKAGE_LOCKFILE,
    LICENSE_TOOL_PROJECT_FILES,
} from '#tests/config/licenses.ts';

/** Write the license settings and a scanner version command before mocking scan output. */
export async function prepareLicenseSandbox(
    root: string,
    plan: string | (typeof ALLOWED_PACKAGE_SCOPE_CASES)[number] = LICENSE_SETTINGS,
): Promise<void> {
    const version = toolDeclaration(configurationManifests().values(), 'pip-licenses').version;
    if (version === undefined) throw new Error('The pip-licenses test requires a pinned version.');
    let settings = typeof plan === 'string' ? plan : LICENSE_SETTINGS;
    let files: Record<string, string> = {
        'pyproject.toml': SAMPLE_PYPROJECT,
        '.venv/installed': 'sample',
    };
    if (typeof plan !== 'string') {
        const { scopes, reports } = plan;
        const allowedPackageText = `[[licenses.allowed_package]]\nname = "Absent_Package"\nversion = "2.0.0"\n${ALLOWED_PACKAGE_ENTRY}`;
        settings += allowedPackageText;
        if ('ignore' in plan)
            settings += `[[ignore]]\ncheck = "licenses/allowed"\npaths = ["${plan.ignore}/**"]\nreason = "Scope is intentionally outside this license run."\n`;
        settings += scopes.map((scope) => `[[scope]]\npath = "${scope}"\n`).join('');
        files = Object.fromEntries(
            Object.keys(reports).flatMap((scope) => [
                [join(scope, 'pyproject.toml'), SAMPLE_PYPROJECT],
                [join(scope, '.venv/installed'), 'installed'],
            ]),
        );
    }
    await createFileTree(root, {
        'gspot.toml': settingsText(['licenses'], { tables: settings }),
        ...files,
        ...(typeof plan === 'string' ? {} : { 'uv.lock': ABSENT_PACKAGE_LOCKFILE, ...LICENSE_TOOL_PROJECT_FILES }),
    });
    await fakeTool(
        root,
        relative(root, join(virtualEnvironmentBin(join(root, '.gspot/.venv')), 'pip-licenses')),
        `console.log(${JSON.stringify('pip-licenses ' + version)});`,
    );
}
