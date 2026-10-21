// Prepare and install the Python tool project.
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from '@decimalturn/toml-patch';
import { getUvPath } from '#cli/tools/locate.ts';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { formatUnavailableNote } from '#cli/tools/inspect.ts';
import { statSync, readFileSync, writeFileSync } from 'node:fs';
import { uvLockSchema } from '#cli/schemas/parsers/lockfiles.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { UvLockfile } from '#cli/types/parsers/lockfiles.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { pythonToolProjectSchema } from '#cli/schemas/install/python/project.ts';
import type { UvExecution, PythonToolProject } from '#cli/types/tools/project.ts';
import { readPythonSettings, writePythonSettings } from '#cli/install/python/settings.ts';
import { PYPROJECT_TOML, PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/dependencies.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/install/credentials.ts';

import {
    DOT_GSPOT,
    UV_LOCKFILE,
    PROJECT_UV_LOCKFILE,
    PYTHON_TOOL_PROJECT_FILE,
    GSPOT_PYTHON_ENVIRONMENT_PATH,
} from '#cli/config/system/locations.ts';
import {
    UV_TOOL,
    UV_PROJECT_FLAGS,
    UV_SETTINGS_FILE,
    UV_RUN_ARGUMENTS,
    UV_VENV_ARGUMENTS,
    PINNED_PACKAGE_NAME,
    UV_INSTALL_ARGUMENTS,
    UV_LOCKFILE_ARGUMENTS,
    UV_ENVIRONMENT_VARIABLE,
    PYTHON_ENVIRONMENT_FOLDER,
    UV_LOCKFILE_CREDENTIAL_MESSAGE,
} from '#cli/config/tools/python.ts';

// A temporary lockfile must not publish credentials supplied through repository index settings.
function readPythonLockfile(work: string, credentials: string[], project: PythonToolProject): string {
    const lockfile = readFileSync(join(work, PROJECT_UV_LOCKFILE), 'utf8');
    assertCredentialFreeLockfile(lockfile, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
    if (!isPythonLockfileCurrent(project, lockfile))
        throw new GspotError(
            'installation',
            'The uv lockfile does not match the tool project. Existing files were preserved.',
        );
    return lockfile;
}

async function runUv(
    context: InstallContext,
    { work, commandArguments, executable, credentials, configFile = join(work, UV_SETTINGS_FILE) }: UvExecution,
): Promise<SpawnResult> {
    const command = [
        executable,
        ...commandArguments,
        UV_PROJECT_FLAGS.project,
        work,
        UV_PROJECT_FLAGS.directory,
        work,
        UV_PROJECT_FLAGS.configFile,
        configFile,
    ];
    const result = await runInstallStep(context, command, {
        cwd: work,
        // The repository's interpreter choice belongs to its own project, not to the tool project of gspot.
        env: { [UV_ENVIRONMENT_VARIABLE]: join(work, PYTHON_ENVIRONMENT_FOLDER), UV_PYTHON: undefined },
    });
    if (result.missing)
        throw new GspotError(
            'tool',
            formatUnavailableNote(getToolDeclaration(context.session.neededToolManifests, UV_TOOL), {
                name: UV_TOOL,
                state: 'missing',
            }),
        );
    if (result.code !== 0)
        throw new GspotError(
            'installation',
            `UV ${String(commandArguments[0])} failed (exit ${String(result.code)}). Check Python downloads and index settings, then run: gspot install.\n${redactInstallOutput(result, credentials)}`,
        );
    return result;
}

/**
 * Resolve the Python tool lockfile outside the repository before writing it.
 *
 * @param context what install needs for this step.
 * @param toolProjectFile the generated pyproject.toml.
 *
 * @returns credential-free lockfile bytes.
 */
async function preparePythonLockfile(context: InstallContext, toolProjectFile: GeneratedFile): Promise<GeneratedFile> {
    const { root } = context.session;
    const owner = context.writer.files;
    const project = pythonToolProjectSchema.parse(parse(toolProjectFile.content));
    const original = owner.read(UV_LOCKFILE);
    const recorded = original?.bytes.toString('utf8');
    if (isPythonLockfileCurrent(project, recorded)) {
        const { credentials } = readPythonSettings(root);
        assertCredentialFreeLockfile(recorded, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
        return { path: UV_LOCKFILE, content: recorded, kind: 'lock', read: original };
    }
    using scratch = createScratchFolder();
    const work = scratch.path;
    writeFileSync(join(work, PYPROJECT_TOML), toolProjectFile.content);

    const credentials = writePythonSettings(root, work);
    await runUv(context, {
        work,
        commandArguments: UV_LOCKFILE_ARGUMENTS,
        executable: getUvPath(context.session),
        credentials,
    });
    return { path: UV_LOCKFILE, content: readPythonLockfile(work, credentials, project), kind: 'lock', read: original };
}

/**
 * Install the frozen Python tool project in .gspot.
 *
 * @param context what install needs for this step.
 * @param executable the path of uv.
 *
 * @returns the install summary.
 */
async function installPythonTools(context: InstallContext, executable: string): Promise<string> {
    const { root } = context.session;
    const owner = context.writer.files;
    const toolProjectFile = owner.read(PYTHON_TOOL_PROJECT_FILE);
    if (toolProjectFile === undefined) return '';
    const work = join(root, DOT_GSPOT);

    using settings = createScratchFolder();
    const credentials = writePythonSettings(root, settings.path);
    for (const commandArguments of [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS]) {
        await runUv(context, {
            work,
            commandArguments,
            executable,
            credentials,
            configFile: join(settings.path, UV_SETTINGS_FILE),
        });
    }
    const project = pythonToolProjectSchema.parse(parse(toolProjectFile.bytes.toString('utf8')));
    return `installed ${formatCount(project.project.dependencies.length, 'Python tool')} in ${GSPOT_PYTHON_ENVIRONMENT_PATH}`;
}

/**
 * Build the command that runs a pinned Python check with the installed project dependencies of the scope.
 *
 * @param selection the scope and its tool declarations.
 * @param scopeRoot the project folder.
 * @param command the target executable and its arguments.
 *
 * @returns the uv command, which syncs neither the project nor its lockfile.
 */
function buildUvRunCommand(selection: ScopeSelection, scopeRoot: string, command: [string, ...string[]]): string[] {
    const tool = getToolDeclaration(selection.selected, command[0]);
    const packagePin = tool.installers['pypi'];
    if (packagePin?.version === undefined)
        throw new GspotError('tool', `The ${tool.name} check has no pinned Python package declaration.`);
    return [
        UV_TOOL,
        ...UV_RUN_ARGUMENTS,
        UV_PROJECT_FLAGS.project,
        scopeRoot,
        '--with',
        `${packagePin.name}==${packagePin.version}`,
        ...command,
    ];
}

// Require pinned specifiers and normalize the requirement names before comparing them.
function parsePinnedRequirements(entry: UvLockfile['package'][number]): string[] | undefined {
    const requirements = entry.metadata?.['requires-dist'] ?? [];
    const pins: string[] = [];
    for (const { name, specifier } of requirements) {
        if (specifier === undefined) return undefined;
        pins.push(`${name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}${specifier}`);
    }
    return pins;
}

// Validate the fields installation needs without making the shared uv schema stricter.
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
            (entry) =>
                entry.version === undefined ||
                entry.source === undefined ||
                entry.metadata?.['requires-dist']?.some(({ specifier }) => specifier === undefined) === true,
        )
    )
        return undefined;
    return parsed.data;
}

/**
 * Compare a Python tool project with the pins recorded in its uv lockfile.
 *
 * @param project the parsed tool project file.
 * @param lockfile the recorded uv.lock contents.
 *
 * @returns whether both validated inputs describe the same requirements.
 */
function isPythonLockfileCurrent(project: PythonToolProject, lockfile: string | undefined): lockfile is string {
    if (lockfile === undefined) return false;
    const projectTable = project.project;
    const recorded = parsePythonToolLockfile(lockfile);
    if (recorded === undefined) return false;
    const projectEntry = recorded.package.find(
        (entry) => entry.name === projectTable.name && entry.source?.virtual === '.',
    );
    if (projectEntry === undefined || recorded['requires-python'] !== projectTable['requires-python']) return false;
    const pins = parsePinnedRequirements(projectEntry);
    if (pins === undefined) return false;
    const expected = projectTable.dependencies
        .map((value) =>
            value.replace(PINNED_PACKAGE_NAME, (name) => name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')),
        )
        .toSorted((left, right) => left.localeCompare(right));
    return isDeepStrictEqual(
        pins.toSorted((left, right) => left.localeCompare(right)),
        expected,
    );
}

/**
 * Point the Python tools that check a scratch copy at the environment the working tree installed. The hook checks a
 * pushed revision in a copy that holds no environment, after it verifies that the dependency files match.
 *
 * @param roots the folder the tools check, and the working tree.
 * @param roots.root the folder the tools check.
 * @param roots.installedRoot the working tree that holds the installed environments.
 * @param scope the project folder.
 * @returns UV_PROJECT_ENVIRONMENT, or nothing in the working tree or for a project without an environment.
 */
function buildScratchPythonEnvironment(
    roots: { root: string; installedRoot: string },
    scope: string,
): Record<string, string> {
    if (roots.root === roots.installedRoot) return {};
    const environment = join(roots.installedRoot, scope, PYTHON_ENVIRONMENT_FOLDER);
    return statSync(environment, { throwIfNoEntry: false })?.isDirectory() === true
        ? { [UV_ENVIRONMENT_VARIABLE]: environment }
        : {};
}

export {
    buildUvRunCommand,
    installPythonTools,
    preparePythonLockfile,
    isPythonLockfileCurrent,
    buildScratchPythonEnvironment,
};
