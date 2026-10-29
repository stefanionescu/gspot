import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { findText } from '#cli/system/files/reads.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { runInstallStep } from '#cli/installers/steps.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { formatUnavailableNote } from '#cli/tools/inspect.ts';
import { compareText, formatCount } from '#cli/system/text.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import { type SpawnResult } from '#cli/types/system/processes.ts';
import { type GeneratedFile } from '#cli/types/generation/files.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import type { ReplacementRequest } from '#cli/types/repository/writer.ts';
import { type UvLockfile } from '#cli/types/parsers/projects/lockfiles.ts';
import { getTool, listToolProjectPins } from '#cli/configurations/tools.ts';
import { uvLockfileSchema } from '#cli/schemas/parsers/projects/lockfiles.ts';
import { PRIVATE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { UV_LOCKFILE, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { UV_TOOL, UV_FLAGS, UV_PROJECT_ENVIRONMENT } from '#cli/config/tools/uv.ts';
import { uvSettingsSchema, uvProjectSettingsSchema } from '#cli/schemas/installers/pypi.ts';
import { type ToolInstall, type MinimumReleaseAge } from '#cli/types/installers/install.ts';
import { PYPROJECT_TOML, PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/projects/dependencies.ts';
import { type UvCommand, type PythonToolProject, type PythonIndexSettings } from '#cli/types/installers/pypi.ts';
import { redactInstallOutput, extractUrlPasswords, assertCredentialFreeLockfile } from '#cli/installers/credentials.ts';

import {
    URL_SCHEME,
    INDEX_SETTINGS,
    PYTHON_TOOL_NOUN,
    UV_SETTINGS_FILE,
    UV_VENV_ARGUMENTS,
    PYTHON_TOOL_PROJECT,
    UV_INSTALL_ARGUMENTS,
    INSECURE_HOST_SETTING,
    INSECURE_HOST_MESSAGE,
    UV_LOCKFILE_ARGUMENTS,
    PYTHON_PACKAGE_ORIGINS,
    REQUIREMENT_PACKAGE_NAME,
    PYTHON_DEFAULT_INDEX_ORIGIN,
    UV_LOCKFILE_CREDENTIAL_MESSAGE,
} from '#cli/config/installers/pypi.ts';

async function runUv(
    install: ToolInstall,
    { runFolder, commandArguments, executable, credentials, configFile = join(runFolder, UV_SETTINGS_FILE) }: UvCommand,
): Promise<SpawnResult> {
    const command = [
        executable,
        ...commandArguments,
        UV_FLAGS.project,
        runFolder,
        UV_FLAGS.directory,
        runFolder,
        UV_FLAGS.configFile,
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

function parsePythonToolLockfile(lockfile: string, minimumReleaseAge?: number): UvLockfile | undefined {
    let parsed;
    try {
        parsed = parseTomlFile(GSPOT_PATHS.uvLockfile, lockfile, uvLockfileSchema);
    } catch (error) {
        if (!(error instanceof GspotError) || error.code !== 'parse') throw error;
        return undefined;
    }
    if (parsed.version !== 1) return undefined;
    if (minimumReleaseAge !== undefined && parsed.options?.['exclude-newer-span'] !== `P${String(minimumReleaseAge)}D`)
        return undefined;
    return parsed;
}

/**
Resolve the Python tool lockfile outside the repository before writing it.

@param install what install needs for this step.
@param toolProjectFile the generated pyproject.toml.
@param executable the path of uv.

@returns credential-free lockfile bytes.
*/
export async function preparePythonLockfile(
    install: ToolInstall,
    toolProjectFile: GeneratedFile,
    executable: string,
): Promise<ReplacementRequest> {
    const { root } = install.session;
    const project = buildPythonProjectTable(install.session.toolConfigurations);
    const previous = install.writer.read(GSPOT_PATHS.uvLockfile);
    const saved = previous?.bytes.toString('utf8');
    const { settings: indexes, credentials: savedCredentials } = readPythonSettings(root);
    if (isPythonLockfileFresh(project, saved, indexes, install.minimumReleaseAge.days)) {
        assertCredentialFreeLockfile(saved, savedCredentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
        return {
            path: GSPOT_PATHS.uvLockfile,
            next: { bytes: Buffer.from(saved), mode: OWNER_WRITABLE_FILE },
            expected: previous,
        };
    }
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PYPROJECT_TOML), toolProjectFile.content);

    writePythonSettings(runFolder, indexes, install.minimumReleaseAge);
    const credentials = savedCredentials;
    await runUv(install, {
        runFolder,
        commandArguments: UV_LOCKFILE_ARGUMENTS,
        executable,
        credentials,
    });
    const lockfile = readFileSync(join(runFolder, UV_LOCKFILE), 'utf8');
    assertCredentialFreeLockfile(lockfile, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
    return {
        path: GSPOT_PATHS.uvLockfile,
        next: { bytes: Buffer.from(lockfile), mode: OWNER_WRITABLE_FILE },
        expected: previous,
    };
}

/**
Install the frozen Python tool project in .gspot.

@param install what install needs for this step.
@param executable the path of uv.
*/
export async function installPythonTools(install: ToolInstall, executable: string): Promise<string> {
    const { root, toolConfigurations } = install.session;
    const runFolder = join(root, GSPOT_FOLDER);

    using settings = createTemporaryFolder();
    const { settings: indexes, credentials } = readPythonSettings(root);
    writePythonSettings(settings.path, indexes, install.minimumReleaseAge);
    for (const commandArguments of [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS]) {
        await runUv(install, {
            runFolder,
            commandArguments,
            executable,
            credentials,
            configFile: join(settings.path, UV_SETTINGS_FILE),
        });
    }
    const count = listToolProjectPins(toolConfigurations).python.length;
    return `installed ${formatCount(count, PYTHON_TOOL_NOUN)} in ${GSPOT_PATHS.pythonEnvironment}`;
}

/**
Compare a Python tool project with the pins recorded in its uv lockfile.

@param project the project table of the tool project.
@param lockfile the recorded uv.lock contents.
@param indexes the configured Python index settings.
@param minimumReleaseAge the required relative release age in days.
*/
export function isPythonLockfileFresh(
    project: PythonToolProject,
    lockfile: string | undefined,
    indexes: PythonIndexSettings['settings'],
    minimumReleaseAge?: number,
): lockfile is string {
    if (lockfile === undefined) return false;
    const saved = parsePythonToolLockfile(lockfile, minimumReleaseAge);
    if (saved === undefined) return false;
    if (!hasAllowedPythonOrigins(saved, indexes)) return false;
    const projectPackage = saved.package.find(
        (lockedPackage) => lockedPackage.name === project.name && lockedPackage.source?.virtual === '.',
    );
    if (projectPackage === undefined || saved['requires-python'] !== project['requires-python']) return false;
    const pins = parseExactRequirements(projectPackage);
    if (pins === undefined) return false;
    const expected = project.dependencies
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

function writePythonSettings(
    settingsFolder: string,
    indexes: PythonIndexSettings['settings'],
    minimumReleaseAge: MinimumReleaseAge,
): void {
    const settings = {
        ...indexes,
        'exclude-newer': `${String(minimumReleaseAge.days)} days`,
        'exclude-newer-package': Object.fromEntries(minimumReleaseAge.pythonExclusions.map((name) => [name, false])),
    };
    writeFileSync(join(settingsFolder, UV_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
}

/**
Read repository index settings and resolve their local paths for a temporary uv project.

@param root the base for local index paths.
*/
export function readPythonSettings(root: string): PythonIndexSettings {
    const uv = findText(root, UV_SETTINGS_FILE);
    const project = findText(root, PYPROJECT_TOML);
    const table =
        uv === undefined
            ? parseTomlFile(PYPROJECT_TOML, project ?? '', uvProjectSettingsSchema).tool.uv
            : parseTomlFile(UV_SETTINGS_FILE, uv, uvSettingsSchema);
    if (table[INSECURE_HOST_SETTING] !== undefined) throw new GspotError('install', INSECURE_HOST_MESSAGE);
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (table['find-links'] !== undefined)
        selected['find-links'] = table['find-links'].map((value) => normalizeIndexLocation(root, value));
    const indexes = (table.index ?? []).map((index) => ({
        ...index,
        url: normalizeIndexLocation(root, index.url),
    }));
    if (table.index !== undefined) selected['index'] = indexes;
    const credentials = Object.entries(selected).flatMap(([key, value]) => {
        const values: unknown[] = Array.isArray(value) ? value : [value];
        const settingValues =
            key === 'index'
                ? indexes.map((index) => index.url)
                : values.filter((element) => typeof element === 'string');
        return settingValues.flatMap((value) => extractUrlPasswords(value));
    });
    return { settings: selected, credentials };
}

/**
Build the project table of the Python tool project: its name, its Python version, and the tool pins.

@param configurations the configurations in use.
@returns the project table that pyproject.toml holds.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The written pyproject.toml and the lockfile state of the installers build the same table through it.
export function buildPythonProjectTable(configurations: Configuration[]): PythonToolProject {
    return { ...PYTHON_TOOL_PROJECT, dependencies: listToolProjectPins(configurations).python };
}
