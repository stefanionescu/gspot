import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { stringify } from '@decimalturn/toml-patch';
import type { Session } from '#cli/types/planning.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { generatedIgnores } from '#cli/generation/ignore-patterns.ts';
import { UV_PROJECT_TABLE } from '#cli/config/generation/tool-projects.ts';
import { PYTHON_TOOL_PROJECT } from '#cli/config/parsers/dependency-files.ts';
import { TOOL_EMIT_FORMAT } from '#cli/config/generation/tool-file-sources.ts';
import type { PythonInputs, GeneratedFile } from '#cli/types/generation/files.ts';
import { TOOL_FILE_DIRECTORY, PYTHON_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';

/**
 * Keep Python lint dependencies in a tool project owned by gspot.
 *
 * @param manifests the selected manifests.
 *
 * @returns the Python tool project files, or none without Python tools.
 */
export function pythonProject(manifests: Manifest[]): GeneratedFile[] {
    const { python: dependencies } = listToolProjectPins(manifests);
    if (dependencies.length === 0) return [];
    return [
        {
            path: PYTHON_TOOL_PROJECT_FILE,
            content:
                stringify({ project: { ...PYTHON_TOOL_PROJECT, dependencies } }, TOOL_EMIT_FORMAT) +
                `\n${UV_PROJECT_TABLE}\n` +
                stringify({ package: false }, TOOL_EMIT_FORMAT),
            kind: 'tool_file',
        },
    ];
}

/**
 * Resolve Python configuration paths for both type and lint tools.
 *
 * @param session the repository and settings.
 * @param selection the scope receiving this generated file.
 *
 * @returns the scope's environment and configuration-relative exclusions.
 */
export function pythonInputs(
    session: Pick<Session, 'root' | 'installedRoot' | 'settingsFile' | 'reads' | 'repository' | 'scopes'>,
    selection: ScopeSelection,
): PythonInputs {
    const root = session.installedRoot;
    const { settings } = session.settingsFile;
    const base = posix.relative(posix.join(TOOL_FILE_DIRECTORY, selection.scope.path), '.');
    const exclusions = generatedIgnores(session);
    return {
        ruffRules: selection.selected.flatMap((manifest) => [
            ...manifest.ruff.recommended,
            ...(settings.level === 'all' ? manifest.ruff.all : []),
        ]),
        pythonScopePath: posix.join(base, selection.scope.path),
        pythonVenv:
            statSync(join(root, selection.scope.path, '.venv'), { throwIfNoEntry: false })?.isDirectory() === true
                ? '.venv'
                : undefined,
        pythonExcludes: (check: string) =>
            [
                ...exclusions,
                ...selection.view
                    .ignoresFor(check)
                    .filter((entry) => entry.rule === undefined)
                    .flatMap((entry) => entry.paths),
            ].map((path) => `${base}/${path}`),
    };
}
