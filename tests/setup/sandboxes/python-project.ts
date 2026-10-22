// Creates a Python project with a lockfile, and points the uv variables at it.
import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

import {
    PYTHON_INDEX_NAME,
    UV_PROJECT_VARIABLES,
    PYTHON_PROJECT_FILES,
    PYTHON_PROJECT_IGNORES,
} from '#tests/data/setup/sandboxes.ts';

/** Creates a Python project with a lockfile and points the uv variables at the sandbox. */
export async function createPythonProject(
    root: string,
    options: { indexFile: 'pyproject.toml' | 'uv.toml'; indexUrl?: string },
): Promise<{
    root: string;
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
    [Symbol.asyncDispose](): Promise<void>;
}> {
    const { indexFile, indexUrl } = options;
    await createFileTree(root, {
        '.gitignore': '.venv/\n',
        'gspot.toml': buildSandboxSettings(['python'], {
            ignore: { checks: PYTHON_PROJECT_IGNORES, reason: 'This test exercises the pinned Ruff installation.' },
            level: 'recommended',
        }),
        ...PYTHON_PROJECT_FILES,
    });
    const resources = new AsyncDisposableStack();
    resources.use(
        overrideEnvironment(
            Object.fromEntries<string | undefined>([
                ['UV_DEFAULT_INDEX', undefined],
                ...UV_PROJECT_VARIABLES.map(
                    (name) => [name, name === 'UV_PROJECT_ENVIRONMENT' ? join(root, '.venv') : root] as const,
                ),
            ]),
        ),
    );
    try {
        const indexPrefix = indexFile === 'pyproject.toml' ? 'tool.uv.' : '';
        const index =
            indexUrl === undefined
                ? ''
                : `[[${indexPrefix}index]]\nname = "${PYTHON_INDEX_NAME}"\nurl = "${indexUrl}"\ndefault = true\n`;
        const authored = indexFile === 'pyproject.toml' ? await readFile(join(root, indexFile), 'utf8') : '';
        await writeFile(join(root, indexFile), authored + index);
        const rootProject = await readFile(join(root, 'pyproject.toml'));
        const rootConfiguration = await readFile(join(root, indexFile));
        commitAll(root);
        await runGspotStep({ root, environment: {}, run: spawnGspot }, ['apply']);
        return {
            root,
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
