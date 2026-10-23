import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from '@decimalturn/toml-patch';
import { getUvPath } from '#cli/tools/locate.ts';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { getTool } from '#cli/configurations/tools.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import { formatUnavailableNote } from '#cli/tools/inspect.ts';
import type { UvCommand } from '#cli/types/install/python.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import type { ToolPyproject } from '#cli/types/install/tool-projects.ts';
import { UV_SETTINGS_FILE } from '#cli/config/install/python/settings.ts';
import { uvLockSchema } from '#cli/schemas/parsers/projects/lockfiles.ts';
import type { UvLockfile } from '#cli/types/parsers/projects/lockfiles.ts';
import { toolPyprojectSchema } from '#cli/schemas/install/python/project.ts';
import { readPythonSettings, writePythonSettings } from '#cli/install/python/settings.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/install/credentials.ts';
import { UV_TOOL, UV_PROJECT_FLAGS, UV_ENVIRONMENT_VARIABLE } from '#cli/config/tools/python.ts';
import { PYPROJECT_TOML, PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/projects/dependencies.ts';

import {
    UV_VENV_ARGUMENTS,
    PROJECT_UV_LOCKFILE,
    UV_INSTALL_ARGUMENTS,
    UV_LOCKFILE_ARGUMENTS,
    REQUIREMENT_PACKAGE_NAME,
    UV_LOCKFILE_CREDENTIAL_MESSAGE,
} from '#cli/config/install/python/project.ts';

function readPythonLockfile(runFolder: string, credentials: string[], project: ToolPyproject): string {
    const lockfile = readFileSync(join(runFolder, PROJECT_UV_LOCKFILE), 'utf8');
    assertCredentialFreeLockfile(lockfile, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
    if (!isPythonLockfileFresh(project, lockfile))
        throw new GspotError(
            'install',
            'The uv lockfile does not match the tool project. gspot kept the existing files.',
        );
    return lockfile;
}

async function runUv(
    install: ToolInstall,
    { runFolder, commandArguments, executable, credentials, configFile = join(runFolder, UV_SETTINGS_FILE) }: UvCommand,
): Promise<SpawnResult> {
    const command = [
        executable,
        ...commandArguments,
        UV_PROJECT_FLAGS.project,
        runFolder,
        UV_PROJECT_FLAGS.directory,
        runFolder,
        UV_PROJECT_FLAGS.configFile,
        configFile,
    ];
    const result = await runInstallStep(install, command, {
        cwd: runFolder,
        env: { [UV_ENVIRONMENT_VARIABLE]: join(runFolder, PYTHON_ENVIRONMENT_FOLDER), UV_PYTHON: undefined },
    });
    if (result.missing)
        throw new GspotError(
            'tool',
            formatUnavailableNote(getTool(install.session.toolConfigurations, UV_TOOL), {
                name: UV_TOOL,
                state: 'missing',
            }),
        );
    if (result.code !== 0)
        throw new GspotError(
            'install',
            `uv ${String(commandArguments[0])} failed (exit ${String(result.code)}).\n${redactInstallOutput(result, credentials)}`,
        );
    return result;
}

function parseExactRequirements(lockedPackage: UvLockfile['package'][number]): string[] | undefined {
    const requirements = lockedPackage.metadata?.['requires-dist'] ?? [];
    const pins: string[] = [];
    for (const { name, specifier } of requirements) {
        if (specifier === undefined) return undefined;
        pins.push(`${name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}${specifier}`);
    }
    return pins;
}

function parsePythonToolLockfile(lockfile: string): UvLockfile | undefined {
    let parsed;
    try {
        parsed = uvLockSchema.safeParse(parse(lockfile));
    } catch (error) {
        if (!(error instanceof Error && 'line' in error && typeof error.line === 'number')) throw error;
        return undefined;
    }
    if (!parsed.success || parsed.data.version !== 1) return undefined;
    if (
        parsed.data.package.some(
            (lockedPackage) =>
                lockedPackage.version === undefined ||
                lockedPackage.source === undefined ||
                lockedPackage.metadata?.['requires-dist']?.some(({ specifier }) => specifier === undefined) === true,
        )
    )
        return undefined;
    return parsed.data;
}

/**
 * Resolve the Python tool lockfile outside the repository before writing it.
 *
 * @param install what install needs for this step.
 * @param toolProjectFile the generated pyproject.toml.
 *
 * @returns credential-free lockfile bytes.
 */
export async function preparePythonLockfile(
    install: ToolInstall,
    toolProjectFile: GeneratedFile,
): Promise<GeneratedFile> {
    const { root } = install.session;
    const owner = install.writer.files;
    const project = toolPyprojectSchema.parse(parse(toolProjectFile.content));
    const original = owner.read(GSPOT_PATHS.uvLockfile);
    const recorded = original?.bytes.toString('utf8');
    if (isPythonLockfileFresh(project, recorded)) {
        const { credentials } = readPythonSettings(root);
        assertCredentialFreeLockfile(recorded, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
        return { path: GSPOT_PATHS.uvLockfile, content: recorded, kind: 'lock', read: original };
    }
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PYPROJECT_TOML), toolProjectFile.content);

    const credentials = writePythonSettings(root, runFolder);
    await runUv(install, {
        runFolder,
        commandArguments: UV_LOCKFILE_ARGUMENTS,
        executable: getUvPath(install.session),
        credentials,
    });
    return {
        path: GSPOT_PATHS.uvLockfile,
        content: readPythonLockfile(runFolder, credentials, project),
        kind: 'lock',
        read: original,
    };
}

/**
 * Install the frozen Python tool project in .gspot.
 *
 * @param install what install needs for this step.
 * @param executable the path of uv.
 *
 * @returns the install summary.
 */
export async function installPythonTools(install: ToolInstall, executable: string): Promise<string> {
    const { root } = install.session;
    const owner = install.writer.files;
    const toolProjectFile = owner.read(GSPOT_PATHS.pythonProject);
    if (toolProjectFile === undefined) return '';
    const runFolder = join(root, DOT_GSPOT);

    using settings = createTemporaryFolder();
    const credentials = writePythonSettings(root, settings.path);
    for (const commandArguments of [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS]) {
        await runUv(install, {
            runFolder,
            commandArguments,
            executable,
            credentials,
            configFile: join(settings.path, UV_SETTINGS_FILE),
        });
    }
    const project = toolPyprojectSchema.parse(parse(toolProjectFile.bytes.toString('utf8')));
    return `installed ${formatCount(project.project.dependencies.length, 'Python tool')} in ${GSPOT_PATHS.pythonEnvironment}`;
}

/**
 * Compare a Python tool project with the pins recorded in its uv lockfile.
 *
 * @param project the parsed tool project file.
 * @param lockfile the recorded uv.lock contents.
 * @returns whether the two files describe the same requirements.
 */
export function isPythonLockfileFresh(project: ToolPyproject, lockfile: string | undefined): lockfile is string {
    if (lockfile === undefined) return false;
    const projectTable = project.project;
    const recorded = parsePythonToolLockfile(lockfile);
    if (recorded === undefined) return false;
    const projectPackage = recorded.package.find(
        (lockedPackage) => lockedPackage.name === projectTable.name && lockedPackage.source?.virtual === '.',
    );
    if (projectPackage === undefined || recorded['requires-python'] !== projectTable['requires-python']) return false;
    const pins = parseExactRequirements(projectPackage);
    if (pins === undefined) return false;
    const expected = projectTable.dependencies
        .map((value) =>
            value.replace(REQUIREMENT_PACKAGE_NAME, (name) =>
                name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-'),
            ),
        )
        .toSorted((left, right) => left.localeCompare(right));
    return isDeepStrictEqual(
        pins.toSorted((left, right) => left.localeCompare(right)),
        expected,
    );
}
