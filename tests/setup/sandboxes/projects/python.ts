import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { PythonProject } from '#tests/types/packages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

import {
    PYTHON_INDEX_NAME,
    UV_PROJECT_VARIABLES,
    PYTHON_PROJECT_FILES,
    PYTHON_PROJECT_IGNORES,
} from '#tests/config/setup/sandboxes.ts';

/**
Create a Python project with a lockfile, and point the uv variables at the sandbox.
*/
export async function createPythonProject(
    root: string,
    options: { indexFile: 'pyproject.toml' | 'uv.toml'; indexUrl?: string },
): Promise<PythonProject> {
    const { indexFile, indexUrl } = options;
    await createFileTree(root, {
        '.gitignore': '.venv/\n',
        'gspot.toml': buildSandboxSettings(['python'], {
            ignore: { checks: PYTHON_PROJECT_IGNORES, reason: 'This test exercises the pinned Ruff installation.' },
            level: 'basic',
        }),
        ...PYTHON_PROJECT_FILES,
    });
    await using resources = new AsyncDisposableStack();
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
    await runGspotStep({ root, run: spawnGspot }, ['apply']);
    const owned = resources.move();
    return {
        rootProject,
        rootConfiguration,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
