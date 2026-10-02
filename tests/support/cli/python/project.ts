import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { everyManifest } from '#cli/kits/select.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { gitignoreBlock } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { preparePythonProject } from '#cli/tools/python.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { miseToolsFile } from '#cli/generation/tools/mise.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { setEnvironmentVariable } from '#tests/support/environment.ts';
import { toolEnvironment } from '#cli/generation/tools/environment.ts';
import type { PreparePythonInstallationResult } from '#tests/types/results.ts';

// The authored files every Python fixture starts from.
const AUTHORED_FILES = {
    'pyproject.toml': '[project]\nname = "authored"\nversion = "1.0.0"\ndependencies = ["authored-dependency"]\n',
    '.venv/authored.txt': 'keep the project environment',
    'source.py': 'import os\n',
};
// The uv variables the fixture points at the sandbox.
const REDIRECTED = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'];

/** Creates an authored Python project, generated lock, and isolated uv environment selectors. */
export async function preparePythonInstallation(
    root: string,
    configuration: string,
    runner: string,
    url: string,
): Promise<PreparePythonInstallationResult> {
    const runnerTable = runner === 'none' ? '' : `[runner]\ntool = "${runner}"\n`;
    await createFileTree(root, {
        '.gitignore': `${gitignoreBlock()}\n.venv/\n`,
        'gspot.toml': policyOf(['python'], `${runnerTable}[guides]\ninstall = false\n`, 'recommended'),
        ...AUTHORED_FILES,
    });
    const session = await openSession(root);
    // This native installation journey selects one shipped Python executable.
    const scopes = session.scopes.map((scope) => ({
        ...scope,
        selected: scope.selected.map((manifest) => ({
            ...manifest,
            tools: manifest.tools.filter((tool) => tool.name === 'ruff'),
        })),
    }));
    const plans = toolEnvironment(everyManifest(scopes));
    if (runner === 'mise') plans.push(miseToolsFile(everyManifest(scopes), session.version, false));
    const previous = ['UV_DEFAULT_INDEX', ...REDIRECTED].map((name) => [name, environmentVariables()[name]] as const);
    const resources = new AsyncDisposableStack();
    resources.defer(() => {
        for (const [name, value] of previous) setEnvironmentVariable(name, value);
    });
    try {
        for (const name of REDIRECTED)
            setEnvironmentVariable(name, name === 'UV_PROJECT_ENVIRONMENT' ? join(root, '.venv') : root);
        setEnvironmentVariable('UV_DEFAULT_INDEX', undefined);
        const index = `[[${configuration === 'pyproject.toml' ? 'tool.uv.' : ''}index]]\nname = "gspot-test"\nurl = "${url}"\ndefault = true\n`;
        const authored = configuration === 'pyproject.toml' ? readFileSync(join(root, configuration), 'utf8') : '';
        writeFileSync(join(root, configuration), authored + index);
        const rootProject = readFileSync(join(root, 'pyproject.toml'));
        const rootConfiguration = readFileSync(join(root, configuration));
        await runOwnedLifecycle(root, async (owner) => {
            await preparePythonProject(root, plans, owner);
            for (const file of plans)
                owner.replace(
                    file.path,
                    { bytes: Buffer.from(file.content), mode: 0o444 },
                    file.kind === 'lock' ? 'lock' : 'config',
                );
        });
        return {
            root,
            scopes,
            plans,
            rootProject,
            rootConfiguration,
            async [Symbol.asyncDispose]() {
                await resources.disposeAsync();
            },
        };
    } catch (error) {
        await resources.disposeAsync();
        throw error;
    }
}
