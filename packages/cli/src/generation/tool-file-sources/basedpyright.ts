import type { Session } from '#cli/types/planning.ts';
import { pythonInputs } from '#cli/generation/python.ts';
import type { EmitInputs } from '#cli/types/generation/files.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { BASEDPYRIGHT_OPTIONS } from '#cli/config/generation/python.ts';

/**
 * Write the basedpyright configuration from selected settings.
 *
 * @param input the source values.
 *
 * @returns the generated configuration text.
 */
export function basedpyrightToolFile(
    input: Pick<EmitInputs, 'selection' | 'scopes'> &
        Pick<Session, 'root' | 'installedRoot' | 'settingsFile' | 'reads' | 'repository'>,
): string {
    const { pythonVenv, pythonScopePath, pythonExcludes } = pythonInputs(input, input.selection);
    const isAll = input.settingsFile.settings.level === 'all';
    return (
        JSON.stringify(
            {
                ...BASEDPYRIGHT_OPTIONS[isAll ? 'all' : 'recommended'],
                ...(pythonVenv === undefined ? {} : { venvPath: pythonScopePath, venv: pythonVenv }),
                include: [pythonScopePath],
                extraPaths: [pythonScopePath],
                exclude: pythonExcludes('python/basedpyright'),
            },
            null,
            JSON_INDENT,
        ) + '\n'
    );
}
