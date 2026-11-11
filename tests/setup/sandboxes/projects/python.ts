import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createFileTree } from 'testdirs';

import { PYTHON_PROJECT_IGNORES } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import type { PythonProject } from '#tests/types/setup.ts';

const PYTHON_PROJECT_FILES = {
    'pyproject.toml': `[project]
name = "authored"
version = "1.0.0"
dependencies = ["authored-dependency"]
`,
    '.venv/authored.txt': 'keep the project environment',
    'source.py': 'import os\n',
} as const;

const UV_PROJECT_VARIABLES = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'] as const;

const PYTHON_INDEX_NAME = 'gspot-test';

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
    const projectVariables = UV_PROJECT_VARIABLES.map(
        (name) => [name, name === 'UV_PROJECT_ENVIRONMENT' ? join(root, '.venv') : root] as const,
    );
    await using resources = new AsyncDisposableStack();
    resources.use(
        overrideEnvironment(
            Object.fromEntries<string | undefined>([['UV_DEFAULT_INDEX', undefined], ...projectVariables]),
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
    await applyGeneratedFiles(root);
    const owned = resources.move();
    return {
        rootProject,
        rootConfiguration,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
