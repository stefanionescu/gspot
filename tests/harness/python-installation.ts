// Bun serves the local Python index used only by private-index credential tests.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { gitignoreBlock } from '#cli/generation/outputs.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { TOOL_PYTHON_PROJECT } from '#cli/config/platform/locations.ts';
import { RUNNER_POLICY, NO_AGENT_RULES } from '#tests/config/harness/policy.ts';
import type { PythonRegistry, RegistryCommand } from '#tests/types/harness/registry.ts';
import { RUFF_VERSION_OUTPUT, PYTHON_REGISTRY_CREDENTIALS } from '#tests/config/harness/registry.ts';
import type { PythonInstallation, PythonInstallationOptions } from '#tests/types/harness/python-installation.ts';
import { REDIRECTED, AUTHORED_FILES, EXCLUDED_PYTHON_CHECKS } from '#tests/config/harness/python-installation.ts';

/** Creates an authored Python project, generated lockfile, and isolated uv environment selectors. */
export async function preparePythonInstallation(
    root: string,
    options: PythonInstallationOptions,
): Promise<PythonInstallation> {
    const { indexFile, indexUrl, runner } = options;
    const ignores = EXCLUDED_PYTHON_CHECKS.map(
        (check) =>
            `[[ignore]]\ncheck = "${check}"\nreason = "This installation scenario exercises the pinned Ruff installation."\n`,
    ).join('\n');
    await createFileTree(root, {
        '.gitignore': `${gitignoreBlock()}\n.venv/\n`,
        'gspot.toml': buildPolicy(['python'], {
            tables: `${RUNNER_POLICY[runner]}${NO_AGENT_RULES}${ignores}`,
            level: 'recommended',
        }),
        ...AUTHORED_FILES,
    });
    const previous = ['UV_DEFAULT_INDEX', ...REDIRECTED].map((name) => [name, environmentVariables()[name]] as const);
    const resources = new AsyncDisposableStack();
    resources.defer(() => {
        for (const [name, value] of previous) setEnvironmentVariable(name, value);
    });
    try {
        for (const name of REDIRECTED)
            setEnvironmentVariable(name, name === 'UV_PROJECT_ENVIRONMENT' ? join(root, '.venv') : root);
        setEnvironmentVariable('UV_DEFAULT_INDEX', undefined);
        const indexPrefix = indexFile === 'pyproject.toml' ? 'tool.uv.' : '';
        const index =
            indexUrl === undefined
                ? ''
                : `[[${indexPrefix}index]]\nname = "gspot-test"\nurl = "${indexUrl}"\ndefault = true\n`;
        const authored = indexFile === 'pyproject.toml' ? readFileSync(join(root, indexFile), 'utf8') : '';
        writeFileSync(join(root, indexFile), authored + index);
        const rootProject = readFileSync(join(root, 'pyproject.toml'));
        const rootConfiguration = readFileSync(join(root, indexFile));
        const applied = await spawnGspot(root, ['apply']);
        if (applied.code !== 0) throw new Error(`Python fixture apply failed: ${applied.stdout}${applied.stderr}`);
        await installGeneratedPythonTools(root);
        const plans: GeneratedFile[] = [
            {
                path: TOOL_PYTHON_PROJECT,
                content: readFileSync(join(root, TOOL_PYTHON_PROJECT), 'utf8'),
                readOnly: true,
                kind: 'config',
            },
        ];
        return {
            root,
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

/**
 * Install the generated pinned Python project and select its companion executables for native checks.
 * @param root the fixture containing an applied Python tool project
 * @returns the private environment ahead of host executable shims
 */
export async function installGeneratedPythonTools(root: string): Promise<Record<string, string>> {
    const installed = await spawnGspot(root, ['install']);
    if (installed.code !== 0)
        throw new Error(`Python tool fixture install failed: ${installed.stdout}${installed.stderr}`);
    return {
        PATH: [
            join(root, '.gspot/.venv', process.platform === 'win32' ? 'Scripts' : 'bin'),
            environmentVariables()['PATH'] ?? '',
        ].join(delimiter),
    };
}

/**
 * Serve a wheel containing Ruff from PATH and a relocatable console entry point.
 * @param work the temporary folder receiving the wheel
 * @param execute the caller's bounded command runner
 * @returns an authenticated registry serving the wheel
 */
export async function createPythonRegistry(work: string, execute: RegistryCommand): Promise<PythonRegistry> {
    const binary = Bun.which('ruff');
    if (binary === null) throw new Error('Ruff is unavailable on PATH.');
    const inspected = await execute([binary, '--version'], { cwd: work });
    if (inspected.code !== 0) throw new Error(`Ruff fixture version failed: ${inspected.stderr}`);
    const version = RUFF_VERSION_OUTPUT.exec(inspected.stdout.trim())?.groups?.['version'];
    if (version === undefined) throw new Error('Ruff fixture version output is invalid.');
    const wheel = `ruff-${version}-py3-none-any.whl`;
    const packed = await execute(
        ['python3', fileURLToPath(new URL('ruff_wheel.py', import.meta.url)), binary, join(work, wheel), version],
        {
            cwd: work,
        },
    );
    if (packed.code !== 0) throw new Error(`Ruff fixture packaging failed: ${packed.stderr}`);
    const archive = readFileSync(join(work, wheel));
    const digest = createHash('sha256').update(archive).digest('hex');
    const { user, password } = PYTHON_REGISTRY_CREDENTIALS;
    const credentials = `${user}:${password}`;
    const authentication = `Basic ${Buffer.from(credentials).toString('base64')}`;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== authentication)
                return new Response('Authentication required', { status: 401 });
            if (new URL(request.url).pathname.endsWith('.whl')) return new Response(archive);
            return new Response(`<a href="/${wheel}#sha256=${digest}">${wheel}</a>`, {
                headers: { 'content-type': 'text/html' },
            });
        },
    });
    return {
        version,
        url: `http://${user}:${password}@127.0.0.1:${String(server.port)}/simple`,
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}
