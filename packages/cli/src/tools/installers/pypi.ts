import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { stringify } from '@decimalturn/toml-patch';

import { GSPOT_PATHS, UV_LOCKFILE } from '#cli/config/manifests.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { GSPOT_FOLDER, OWNER_WRITABLE_FILE, PRIVATE_FILE, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import {
    INDEX_SETTINGS,
    NETWORK_ADVICE,
    PYTHON_DEFAULT_INDEX_ORIGIN,
    PYTHON_PACKAGE_ORIGINS,
    PYTHON_TOOL_NOUN,
    REQUIREMENT_PACKAGE_NAME,
    URL_SCHEME,
    UV_FLAGS,
    UV_INSTALL_ARGUMENTS,
    UV_LOCKFILE_ARGUMENTS,
    UV_LOCKFILE_CREDENTIAL_MESSAGE,
    UV_PROJECT_ENVIRONMENT,
    UV_PROJECT_INSTALL_ARGUMENTS,
    UV_SETTINGS_FILE,
    UV_STALE_LOCKFILE,
    UV_TOOL,
} from '#cli/config/tools/installers.ts';
import { ROOT_FOLDER_NAME } from '#cli/config/tools/programs.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { normalizePythonName } from '#cli/parsers/projects/lockfiles.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { uvLockfileSchema, uvProjectSettingsSchema, uvSettingsSchema } from '#cli/schemas/tools.ts';
import { GspotError, tryParseFile } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { findText } from '#cli/system/files/reads.ts';
import { compareText, formatCount } from '#cli/system/text.ts';
import { formatUnavailableNote } from '#cli/tools/inspect.ts';
import {
    assertCredentialFreeLockfile,
    extractUrlPasswords,
    redactInstallOutput,
} from '#cli/tools/installers/credentials.ts';
import {
    explainReleaseAgeHold,
    listPythonReleases,
    runInstallStep,
    runRequiredInstallStep,
} from '#cli/tools/installers/steps.ts';
import { findRepositoryPython } from '#cli/tools/locate.ts';
import { buildPythonProjectTable, listPackagePins } from '#cli/tools/pins.ts';
import type { ReplacementRequest } from '#cli/types/repository.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import type {
    GeneratedFile,
    PythonIndexSettings,
    PythonToolProject,
    ToolInstall,
    UvCommand,
    UvLockfile,
} from '#cli/types/tools.ts';

async function runUv(
    install: ToolInstall,
    { runFolder, commandArguments, executable, config = join(runFolder, UV_SETTINGS_FILE) }: UvCommand,
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
    if (result.end === 'missing') {
        const uv = getTool(readConfigurations().values(), UV_TOOL);
        throw new GspotError('install', formatUnavailableNote(uv, { name: UV_TOOL, state: 'missing' }));
    }
    if (result.code !== 0) {
        const output = redactInstallOutput(result, install.pythonSettings.credentials);
        const pins = listPackagePins(install.session.toolConfigurations).python;
        const explanation = await explainReleaseAgeHold(install, output, listPythonReleases(pins));
        const exit = result.signal === undefined ? `exit ${String(result.code)}` : `stopped by ${result.signal}`;
        throw new GspotError('install', `${explanation}uv ${String(commandArguments[0])} failed (${exit}).\n${output}`);
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
    const parsed = tryParseFile(() => parseTomlFile(GSPOT_PATHS.uvLockfile, lockfile, uvLockfileSchema));
    if (parsed?.version !== 1) return undefined;
    return minimumReleaseAge === undefined ||
        parsed.options?.['exclude-newer-span'] === `P${String(minimumReleaseAge)}D`
        ? parsed
        : undefined;
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

function writeUvSettings(folder: string, indexes: PythonIndexSettings['settings'], days: number): void {
    const settings = stringify({ ...indexes, 'exclude-newer': `${String(days)} days` });
    writeFileSync(join(folder, UV_SETTINGS_FILE), settings, { mode: PRIVATE_FILE });
}

/**
Name the Python for a project environment that does not exist yet: the one that a mise config file of the repository
sets for the project folder. uv picks the interpreter when mise is absent, or when no such file sets one. An
environment that exists keeps its Python, because uv builds an environment again for another one and drops what the
project added to it.
*/
async function listInterpreterArguments(install: ToolInstall, cwd: string): Promise<string[]> {
    const { misePath, session } = install;
    const hasEnvironment = statSync(join(cwd, PYTHON_ENVIRONMENT_FOLDER), { throwIfNoEntry: false }) !== undefined;
    if (misePath === undefined || hasEnvironment) return [];
    const python = await findRepositoryPython(session.root, cwd, {
        misePath,
        cancelSignal: session.cancelSignal,
        timeoutSeconds: session.settings.tool_timeout_seconds,
    });
    return python === undefined ? [] : [UV_FLAGS.python, python];
}

export async function planPythonLockfile(
    install: ToolInstall,
    toolProjectFile: GeneratedFile,
    executable: string,
): Promise<ReplacementRequest> {
    const project = buildPythonProjectTable(install.session.toolConfigurations);
    const previous = install.writer.read(GSPOT_PATHS.uvLockfile);
    const saved = previous?.bytes.toString('utf8');
    const { settings: indexes, credentials } = install.pythonSettings;
    if (saved !== undefined && isPythonLockfileFresh(project, saved, indexes, install.releaseAgeDays)) {
        assertCredentialFreeLockfile(saved, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
        return {
            path: GSPOT_PATHS.uvLockfile,
            next: { bytes: Buffer.from(saved), mode: OWNER_WRITABLE_FILE },
            previous,
        };
    }
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PYPROJECT_TOML), toolProjectFile.content);
    writeUvSettings(runFolder, indexes, install.releaseAgeDays);
    await runUv(install, { runFolder, commandArguments: UV_LOCKFILE_ARGUMENTS, executable });
    const lockfile = readFileSync(join(runFolder, UV_LOCKFILE), 'utf8');
    assertCredentialFreeLockfile(lockfile, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
    return {
        path: GSPOT_PATHS.uvLockfile,
        next: { bytes: Buffer.from(lockfile), mode: OWNER_WRITABLE_FILE },
        previous,
    };
}

export async function installPythonTools(
    install: ToolInstall,
    executable: string,
    flags: readonly string[] = [],
): Promise<string> {
    const { root, toolConfigurations } = install.session;
    const runFolder = join(root, GSPOT_FOLDER);

    using settings = createTemporaryFolder();
    writeUvSettings(settings.path, install.pythonSettings.settings, install.releaseAgeDays);
    await runUv(install, {
        runFolder,
        commandArguments: [...UV_INSTALL_ARGUMENTS, ...flags],
        executable,
        config: join(settings.path, UV_SETTINGS_FILE),
    });
    const count = listPackagePins(toolConfigurations).python.length;
    return `installed ${formatCount(count, PYTHON_TOOL_NOUN)} in ${GSPOT_PATHS.pythonEnvironment}`;
}

export function listLockedPythonProjects(session: Pick<ToolInstall['session'], 'repository' | 'scopes'>): string[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    return session.scopes
        .map((scope) => scope.path)
        .filter(
            (folder) => tracked.has(joinScope(folder, UV_LOCKFILE)) && tracked.has(joinScope(folder, PYPROJECT_TOML)),
        );
}

export async function installPythonProjects(install: ToolInstall, executable: string): Promise<string[]> {
    const { root } = install.session;
    const lines = listLockedPythonProjects(install.session).map((folder) => {
        const place = folder === '' ? ROOT_FOLDER_NAME : folder;
        return { folder, place };
    });
    for (const { folder, place } of lines) {
        const cwd = join(root, folder);
        const python = await listInterpreterArguments(install, cwd);
        await runRequiredInstallStep(install, [executable, ...UV_PROJECT_INSTALL_ARGUMENTS, ...python], {
            cwd,
            step: `installing the Python environment of ${place}`,
            name: `uv sync in ${place}`,
            readAdvice: (result) =>
                UV_STALE_LOCKFILE.test(result.stderr)
                    ? `Run uv lock in ${place} to update ${UV_LOCKFILE}, then run gspot install again.`
                    : NETWORK_ADVICE,
        });
    }
    return lines.map(({ place }) => `installed the Python environment of ${place}`);
}

export function isPythonLockfileFresh(
    project: PythonToolProject,
    lockfile: string | undefined,
    indexes?: PythonIndexSettings['settings'],
    minimumReleaseAge?: number,
): boolean {
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

export function readPythonSettings(root: string): PythonIndexSettings {
    const uv = findText(root, UV_SETTINGS_FILE);
    const project = findText(root, PYPROJECT_TOML);
    const table =
        uv === undefined
            ? parseTomlFile(PYPROJECT_TOML, project ?? '', uvProjectSettingsSchema).tool.uv
            : parseTomlFile(UV_SETTINGS_FILE, uv, uvSettingsSchema);
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (table['find-links'] !== undefined)
        selected['find-links'] = table['find-links'].map((value) =>
            URL_SCHEME.test(value) ? value : resolve(root, value),
        );
    const indexes = (table.index ?? []).map((index) => ({
        ...index,
        url: URL_SCHEME.test(index.url) ? index.url : resolve(root, index.url),
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
