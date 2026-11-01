import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { find } from '#cli/system/files/reads.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { joinScope } from '#cli/repository/scopes.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import type { SpawnResult } from '#cli/types/system.ts';
import { uvLockfileSchema } from '#cli/schemas/parsers.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { formatUnavailableNote } from '#cli/tools/inspect.ts';
import { getTool, listPackagePins } from '#cli/tools/pins.ts';
import { compareText, formatCount } from '#cli/system/text.ts';
import type { ReplacementRequest } from '#cli/types/repository.ts';
import { GSPOT_PATHS, UV_LOCKFILE } from '#cli/config/manifests.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { GSPOT_FOLDER, PYPROJECT_TOML } from '#cli/config/parsers.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { normalizePythonName } from '#cli/parsers/projects/lockfiles.ts';
import { PRIVATE_FILE, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { uvSettingsSchema, uvProjectSettingsSchema } from '#cli/schemas/tools.ts';

import {
    redactInstallOutput,
    extractUrlPasswords,
    assertCredentialFreeLockfile,
} from '#cli/tools/installers/credentials.ts';
import {
    runInstallStep,
    listPythonReleases,
    explainReleaseAgeHold,
    runRequiredInstallStep,
} from '#cli/tools/installers/steps.ts';
import type {
    UvCommand,
    UvLockfile,
    ToolInstall,
    GeneratedFile,
    PythonToolProject,
    PythonIndexSettings,
} from '#cli/types/tools.ts';
import {
    UV_TOOL,
    UV_FLAGS,
    URL_SCHEME,
    INDEX_SETTINGS,
    PYTHON_TOOL_NOUN,
    UV_SETTINGS_FILE,
    PYTHON_TOOL_PROJECT,
    UV_INSTALL_ARGUMENTS,
    UV_LOCKFILE_ARGUMENTS,
    UV_PROJECT_ENVIRONMENT,
    PYTHON_PACKAGE_ORIGINS,
    REQUIREMENT_PACKAGE_NAME,
    PYTHON_DEFAULT_INDEX_ORIGIN,
    UV_PROJECT_INSTALL_ARGUMENTS,
    UV_LOCKFILE_CREDENTIAL_MESSAGE,
} from '#cli/config/tools/installers.ts';

async function runUv(
    install: ToolInstall,
    { runFolder, commandArguments, executable, credentials, config = join(runFolder, UV_SETTINGS_FILE) }: UvCommand,
): Promise<SpawnResult> {
    const command = [
        executable,
        ...commandArguments,
        UV_FLAGS.project,
        runFolder,
        UV_FLAGS.directory,
        runFolder,
        UV_FLAGS.config,
        config,
    ];
    const result = await runInstallStep(install, command, {
        cwd: runFolder,
        env: { [UV_PROJECT_ENVIRONMENT]: join(runFolder, PYTHON_ENVIRONMENT_FOLDER), UV_PYTHON: undefined },
        step: `running uv ${commandArguments.join(' ')} for ${GSPOT_PATHS.pythonProject}`,
    });
    if (result.missing)
        throw new GspotError(
            'install',
            formatUnavailableNote(getTool(install.session.toolConfigurations, UV_TOOL), {
                name: UV_TOOL,
                state: 'missing',
            }),
        );
    if (result.code !== 0) {
        const output = redactInstallOutput(result, credentials);
        const pins = listPackagePins(install.session.toolConfigurations).python;
        const explanation = await explainReleaseAgeHold(install, output, listPythonReleases(pins));
        throw new GspotError(
            'install',
            `${explanation}uv ${String(commandArguments[0])} failed (exit ${String(result.code)}).\n${output}`,
        );
    }
    return result;
}

function parseExactRequirements(lockedPackage: UvLockfile['package'][number]): string[] | undefined {
    const requirements = lockedPackage.metadata?.['requires-dist'] ?? [];
    const pins: string[] = [];
    for (const { name, specifier } of requirements) {
        if (specifier === undefined) return undefined;
        pins.push(`${normalizePythonName(name)}${specifier}`);
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

function hasAllowedPythonOrigins(lockfile: UvLockfile, indexes: PythonIndexSettings['settings']): boolean {
    const configured = [
        ...(indexes.index ?? []).map((index) => index.url),
        ...(indexes['index-url'] === undefined ? [] : [indexes['index-url']]),
        ...(indexes['extra-index-url'] ?? []),
        ...(indexes['find-links'] ?? []),
    ];
    const hasDefaultIndexOverride =
        indexes['index-url'] !== undefined || indexes.index?.some((index) => index.default === true) === true;
    const origins = new Set(
        [...PYTHON_PACKAGE_ORIGINS, ...(hasDefaultIndexOverride ? [] : [PYTHON_DEFAULT_INDEX_ORIGIN]), ...configured]
            .filter((url) => URL.canParse(url))
            .map((url) => new URL(url).origin),
    );
    return lockfile.package
        .flatMap(({ source, sdist, wheels = [] }) => [
            source?.registry,
            sdist?.url,
            ...wheels.map((wheel) => wheel.url),
        ])
        .filter((address) => address !== undefined)
        .every((address) =>
            URL.canParse(address) ? origins.has(new URL(address).origin) : configured.includes(address),
        );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The lockfile step and the install step write the same private settings file through it.
function writeUvSettings(folder: string, indexes: PythonIndexSettings['settings'], days: number): void {
    const settings = stringify({ ...indexes, 'exclude-newer': `${String(days)} days` });
    writeFileSync(join(folder, UV_SETTINGS_FILE), settings, { mode: PRIVATE_FILE });
}

function normalizeIndexLocation(root: string, location: string): string {
    if (URL_SCHEME.test(location)) return location;
    return resolve(root, location);
}

/**
Resolve the Python tool lockfile outside the repository before writing it.

@param install what install needs for this step.
@param toolProjectFile the generated pyproject.toml.
@param executable the path of uv.

@returns credential-free lockfile bytes.
*/
export async function planPythonLockfile(
    install: ToolInstall,
    toolProjectFile: GeneratedFile,
    executable: string,
): Promise<ReplacementRequest> {
    const project = buildPythonProjectTable(install.session.toolConfigurations);
    const previous = install.writer.read(GSPOT_PATHS.uvLockfile);
    const saved = previous?.bytes.toString('utf8');
    const { settings: indexes, credentials } = install.pythonSettings;
    if (isPythonLockfileFresh(project, saved, indexes, install.releaseAgeDays)) {
        assertCredentialFreeLockfile(saved, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
        return {
            path: GSPOT_PATHS.uvLockfile,
            next: { bytes: Buffer.from(saved), mode: OWNER_WRITABLE_FILE },
            previous: previous,
        };
    }
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PYPROJECT_TOML), toolProjectFile.content);
    writeUvSettings(runFolder, indexes, install.releaseAgeDays);
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
        previous: previous,
    };
}

/**
Install the frozen Python tool project in .gspot.

@param install what install needs for this step.
@param executable the path of uv.
@param flags the flags after the install command.
*/
export async function installPythonTools(
    install: ToolInstall,
    executable: string,
    flags: readonly string[] = [],
): Promise<string> {
    const { root, toolConfigurations } = install.session;
    const runFolder = join(root, GSPOT_FOLDER);

    using settings = createTemporaryFolder();
    const { settings: indexes, credentials } = install.pythonSettings;
    writeUvSettings(settings.path, indexes, install.releaseAgeDays);
    await runUv(install, {
        runFolder,
        commandArguments: [...UV_INSTALL_ARGUMENTS, ...flags],
        executable,
        credentials,
        config: join(settings.path, UV_SETTINGS_FILE),
    });
    const count = listPackagePins(toolConfigurations).python.length;
    return `installed ${formatCount(count, PYTHON_TOOL_NOUN)} in ${GSPOT_PATHS.pythonEnvironment}`;
}

/**
Install the environment of each Python project with a uv lockfile, so that its checks read the real packages.

@param install what install needs for this step.
@param executable the path of uv.
@returns one line for each project.
*/
export async function installPythonProjects(install: ToolInstall, executable: string): Promise<string[]> {
    const { root, repository, scopes } = install.session;
    const tracked = new Set(repository.files.map((file) => file.path));
    const folders = scopes
        .map((scope) => scope.path)
        .filter(
            (folder) => tracked.has(joinScope(folder, UV_LOCKFILE)) && tracked.has(joinScope(folder, PYPROJECT_TOML)),
        );
    const lines = folders.map((folder) => {
        const place = folder === '' ? 'the repository root' : folder;
        return { folder, place };
    });
    for (const { folder, place } of lines)
        await runRequiredInstallStep(install, [executable, ...UV_PROJECT_INSTALL_ARGUMENTS], {
            cwd: join(root, folder),
            step: `installing the Python environment of ${place}`,
            name: `uv sync in ${place}`,
        });
    return lines.map(({ place }) => `installed the Python environment of ${place}`);
}

/**
Compare a Python tool project with the pins recorded in its uv lockfile.

@param project the project table of the tool project.
@param lockfile the recorded uv.lock contents.
@param indexes the configured Python index settings, which the download addresses must match when given.
@param minimumReleaseAge the required relative release age in days.
*/
export function isPythonLockfileFresh(
    project: PythonToolProject,
    lockfile: string | undefined,
    indexes?: PythonIndexSettings['settings'],
    minimumReleaseAge?: number,
): lockfile is string {
    if (lockfile === undefined) return false;
    const saved = parsePythonToolLockfile(lockfile, minimumReleaseAge);
    if (saved === undefined) return false;
    if (indexes !== undefined && !hasAllowedPythonOrigins(saved, indexes)) return false;
    const projectPackage = saved.package.find(
        (lockedPackage) => lockedPackage.name === project.name && lockedPackage.source?.virtual === '.',
    );
    if (projectPackage === undefined || saved['requires-python'] !== project['requires-python']) return false;
    const pins = parseExactRequirements(projectPackage);
    if (pins === undefined) return false;
    const expected = project.dependencies
        .map((value) => value.replace(REQUIREMENT_PACKAGE_NAME, (name) => normalizePythonName(name)))
        .toSorted((left, right) => compareText(left, right));
    return isDeepStrictEqual(
        pins.toSorted((left, right) => compareText(left, right)),
        expected,
    );
}

/**
Read repository index settings and resolve their local paths for a temporary uv project.

@param root the base for local index paths.
*/
export function readPythonSettings(root: string): PythonIndexSettings {
    const uv = find(root, UV_SETTINGS_FILE);
    const project = find(root, PYPROJECT_TOML);
    const table =
        uv === undefined
            ? parseTomlFile(PYPROJECT_TOML, project ?? '', uvProjectSettingsSchema).tool.uv
            : parseTomlFile(UV_SETTINGS_FILE, uv, uvSettingsSchema);
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
    return { ...PYTHON_TOOL_PROJECT, dependencies: listPackagePins(configurations).python };
}
