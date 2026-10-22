import { posix } from 'node:path';
import { joinScope } from '#cli/repository/scopes.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { PROJECT_UV_LOCKFILE } from '#cli/config/gspot-paths.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/repository/tracked.ts';
import { listPythonIgnoredGlobs } from '#cli/generation/config-files/ignore-files.ts';

import {
    BASEDPYRIGHT_OPTIONS,
    BASEDPYRIGHT_ALL_LEVEL_OPTIONS,
} from '#cli/config/generation/config-files/builders/basedpyright.ts';

/**
 * Build basedpyright.json: the Python environment and source paths used by Basedpyright.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Python environment and source paths used by Basedpyright.
 */
export function buildBasedpyrightFile(planned: PlannedConfigFile): string {
    const pythonScopePath = posix.join(
        posix.relative(posix.dirname(planned.targetPath), '.'),
        planned.scope.folder.path,
    );
    // uv records the environment beside its tracked lockfile, even before the environment exists locally.
    const pythonVenv = planned.session.repository.files.some(
        (file) => file.path === joinScope(planned.scope.folder.path, PROJECT_UV_LOCKFILE),
    )
        ? PYTHON_ENVIRONMENT_FOLDER
        : undefined;
    const extraPaths = planned.scope.settings.values.python?.extra_paths ?? [];
    return JSON.stringify(
        {
            ...BASEDPYRIGHT_OPTIONS,
            ...(planned.level === 'all' ? BASEDPYRIGHT_ALL_LEVEL_OPTIONS : {}),
            typeCheckingMode: planned.level,
            ...(pythonVenv === undefined ? {} : { venvPath: pythonScopePath, venv: pythonVenv }),
            include: [pythonScopePath],
            extraPaths: [pythonScopePath, ...extraPaths.map((path) => posix.join(pythonScopePath, path))],
            exclude: listPythonIgnoredGlobs(planned, 'python/basedpyright'),
        },
        null,
        JSON_INDENT,
    );
}
