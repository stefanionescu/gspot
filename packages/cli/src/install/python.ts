import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { getUvPath } from '#cli/tools/locate.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { getTool } from '#cli/configurations/tools.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { formatUnavailableNote } from '#cli/tools/inspect.ts';
import { compareText, formatCount } from '#cli/system/text.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import type { ToolPyproject } from '#cli/types/install/tool-projects.ts';
import { uvLockSchema } from '#cli/schemas/parsers/projects/lockfiles.ts';
import type { UvLockfile } from '#cli/types/parsers/projects/lockfiles.ts';
import { type UvCommand, type PythonIndexSettings } from '#cli/types/install/python.ts';
import { PROJECT_UV_LOCKFILE, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { UV_TOOL, UV_PROJECT_FLAGS, UV_PROJECT_ENVIRONMENT } from '#cli/config/tools/python.ts';
import { PYPROJECT_TOML, PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/projects/dependencies.ts';
import { uvSettingsSchema, toolPyprojectSchema, uvProjectSettingsSchema } from '#cli/schemas/install/python.ts';
import { redactInstallOutput, extractUrlPasswords, assertCredentialFreeLockfile } from '#cli/install/credentials.ts';

import {
    HTTP_URL,
    URL_SCHEME,
    INDEX_SETTINGS,
    UV_SETTINGS_FILE,
    UV_VENV_ARGUMENTS,
    MILLISECONDS_PER_DAY,
    UV_INSTALL_ARGUMENTS,
    UV_LOCKFILE_ARGUMENTS,
    PYTHON_PACKAGE_ORIGINS,
    REQUIREMENT_PACKAGE_NAME,
    PYTHON_DEFAULT_INDEX_ORIGIN,
    UV_LOCKFILE_CREDENTIAL_MESSAGE,
} from '#cli/config/install/python.ts';

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
        env: { [UV_PROJECT_ENVIRONMENT]: join(runFolder, PYTHON_ENVIRONMENT_FOLDER), UV_PYTHON: undefined },
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
    return parsed.success && parsed.data.version === 1 ? parsed.data : undefined;
}

/**
Resolve the Python tool lockfile outside the repository before writing it.

@param install what install needs for this step.
@param toolProjectFile the generated pyproject.toml.

@returns credential-free lockfile bytes.
*/
export async function preparePythonLockfile(
    install: ToolInstall,
    toolProjectFile: GeneratedFile,
): Promise<GeneratedFile> {
    const { root } = install.session;
    const project = toolPyprojectSchema.parse(parse(toolProjectFile.content));
    const previous = install.writer.read(GSPOT_PATHS.uvLockfile);
    const saved = previous?.bytes.toString('utf8');
    const { settings: indexes, credentials: savedCredentials } = readPythonSettings(root);
    if (isPythonLockfileFresh(project, saved, indexes)) {
        assertCredentialFreeLockfile(saved, savedCredentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
        return { path: GSPOT_PATHS.uvLockfile, content: saved, kind: 'lock', read: previous };
    }
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PYPROJECT_TOML), toolProjectFile.content);

    const credentials = writePythonSettings(root, runFolder, install.releaseAgeDays);
    await runUv(install, {
        runFolder,
        commandArguments: UV_LOCKFILE_ARGUMENTS,
        executable: getUvPath(install.session),
        credentials,
    });
    const lockfile = readFileSync(join(runFolder, PROJECT_UV_LOCKFILE), 'utf8');
    assertCredentialFreeLockfile(lockfile, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
    return {
        path: GSPOT_PATHS.uvLockfile,
        content: lockfile,
        kind: 'lock',
        read: previous,
    };
}

/**
Install the frozen Python tool project in .gspot.

@param install what install needs for this step.
@param executable the path of uv.

@returns the install summary.
*/
export async function installPythonTools(install: ToolInstall, executable: string): Promise<string> {
    const { root } = install.session;
    const toolProjectFile = install.writer.read(GSPOT_PATHS.pythonProject);
    if (toolProjectFile === undefined) return '';
    const runFolder = join(root, DOT_GSPOT);

    using settings = createTemporaryFolder();
    const credentials = writePythonSettings(root, settings.path, install.releaseAgeDays);
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
Compare a Python tool project with the pins recorded in its uv lockfile.

@param project the parsed tool project file.
@param lockfile the recorded uv.lock contents.
@param indexes the configured Python index settings.
@returns whether the two files describe the same requirements.
*/
export function isPythonLockfileFresh(
    project: ToolPyproject,
    lockfile: string | undefined,
    indexes: PythonIndexSettings['settings'],
): lockfile is string {
    if (lockfile === undefined) return false;
    const projectTable = project.project;
    const saved = parsePythonToolLockfile(lockfile);
    if (saved === undefined) return false;
    if (!hasAllowedPythonOrigins(saved, indexes)) return false;
    const projectPackage = saved.package.find(
        (lockedPackage) => lockedPackage.name === projectTable.name && lockedPackage.source?.virtual === '.',
    );
    if (projectPackage === undefined || saved['requires-python'] !== projectTable['requires-python']) return false;
    const pins = parseExactRequirements(projectPackage);
    if (pins === undefined) return false;
    const expected = projectTable.dependencies
        .map((value) =>
            value.replace(REQUIREMENT_PACKAGE_NAME, (name) =>
                name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-'),
            ),
        )
        .toSorted((left, right) => compareText(left, right));
    return isDeepStrictEqual(
        pins.toSorted((left, right) => compareText(left, right)),
        expected,
    );
}

function hasAllowedPythonOrigins(lockfile: UvLockfile, indexes: PythonIndexSettings['settings']): boolean {
    const configured = Object.entries(indexes).flatMap(([key, value]) => {
        if (key === 'index' && Array.isArray(value))
            return value.flatMap((index) => (isTable(index) && typeof index['url'] === 'string' ? [index['url']] : []));
        if (['index-url', 'extra-index-url', 'find-links'].includes(key)) {
            if (Array.isArray(value)) return value.filter((url): url is string => typeof url === 'string');
            if (typeof value === 'string') return [value];
        }
        return [];
    });
    const hasDefaultIndexOverride =
        indexes['index-url'] !== undefined || indexes.index?.some((index) => index['default'] === true) === true;
    const origins = new Set(
        [...PYTHON_PACKAGE_ORIGINS, ...(hasDefaultIndexOverride ? [] : [PYTHON_DEFAULT_INDEX_ORIGIN]), ...configured]
            .filter((url) => URL.canParse(url))
            .map((url) => new URL(url).origin),
    );
    return lockfile.package.every((lockedPackage) => {
        const addresses = [
            lockedPackage.source?.['registry'],
            ...(isTable(lockedPackage['sdist']) ? [lockedPackage['sdist']['url']] : []),
            ...(Array.isArray(lockedPackage['wheels'])
                ? lockedPackage['wheels'].map((wheel: unknown) => (isTable(wheel) ? wheel['url'] : undefined))
                : []),
        ];
        return addresses.every(
            (address) =>
                address === undefined ||
                (typeof address === 'string' &&
                    (URL.canParse(address) ? origins.has(new URL(address).origin) : configured.includes(address))),
        );
    });
}

function normalizeIndexLocation(root: string, location: string): string {
    if (URL_SCHEME.test(location)) return location;
    return resolve(root, location);
}

/**
Copy repository uv index settings into the temporary folder, make relative paths absolute, and collect registry
credentials.

@param repositoryRoot the base folder for reading uv settings and resolving local index paths.
@param settingsFolder the folder where the resolution runs.
@param days the minimum age of a release, in days.
@returns index credentials that must stay out of generated lockfiles.
*/
export function writePythonSettings(repositoryRoot: string, settingsFolder: string, days: number): string[] {
    const { settings, credentials } = readPythonSettings(repositoryRoot);
    settings['exclude-newer'] = new Date(Date.now() - days * MILLISECONDS_PER_DAY).toISOString();
    writeFileSync(join(settingsFolder, UV_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
    return credentials;
}

/**
Read repository index settings and resolve their local paths for a temporary uv project.

@param repositoryRoot the base for local index paths.
@returns the index settings, and the passwords to keep out of generated lockfiles and messages.
*/
export function readPythonSettings(repositoryRoot: string): PythonIndexSettings {
    const uv = findText(repositoryRoot, UV_SETTINGS_FILE);
    const project = findText(repositoryRoot, PYPROJECT_TOML);
    const table =
        uv === undefined
            ? parseTomlFile(PYPROJECT_TOML, project ?? '', uvProjectSettingsSchema).tool.uv
            : parseTomlFile(UV_SETTINGS_FILE, uv, uvSettingsSchema);
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (table['find-links'] !== undefined)
        selected['find-links'] = table['find-links'].map((value) => normalizeIndexLocation(repositoryRoot, value));
    const indexes = (table.index ?? []).map((index) => ({
        ...index,
        url: normalizeIndexLocation(repositoryRoot, index.url),
    }));
    if (table.index !== undefined) selected['index'] = indexes;
    const credentials = Object.entries(selected).flatMap(([key, value]) => {
        const values: unknown[] = Array.isArray(value) ? value : [value];
        const settingValues =
            key === 'index'
                ? indexes.map((index) => index.url)
                : values.filter((element) => typeof element === 'string');
        return settingValues.filter((value) => HTTP_URL.test(value)).flatMap((value) => extractUrlPasswords(value));
    });
    return { settings: selected, credentials };
}
