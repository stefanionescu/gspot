import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { patch } from '@decimalturn/toml-patch';

import { GSPOT_PATHS, MISE_CONFIG_FILE, MISE_LOCKFILE } from '#cli/config/manifests.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import {
    GITHUB_RATE_LIMIT,
    GITHUB_TOKEN_MESSAGE,
    MISE_BIN_PATHS_ARGUMENTS,
    MISE_CEILING_PATHS_VARIABLE,
    MISE_CHECKSUM_PATTERN,
    MISE_FORCE_FLAG,
    MISE_INSTALL_ARGUMENTS,
    MISE_LOCK_ARGUMENTS,
    MISE_LOCK_ENVIRONMENT,
    MISE_LOCKED_ENVIRONMENT,
    MISE_PLATFORM_PREFIX,
    MISE_RELEASE_HOSTS,
    MISE_RELEASE_PROTOCOL,
    MISE_TOOL_NOUN,
    MISE_TRUSTED_PATHS_VARIABLE,
    NETWORK_ADVICE,
    UV_TOOL,
} from '#cli/config/tools/installers.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { planReplacements, writePlans } from '#cli/repository/writer.ts';
import { miseLockfileSchema } from '#cli/schemas/tools.ts';
import { readHost } from '#cli/system/environment.ts';
import { GspotError, tryParseFile } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { findProgram } from '#cli/system/programs.ts';
import { getRequired, isTable } from '#cli/system/tables.ts';
import { formatCount } from '#cli/system/text.ts';
import { redactInstallOutput } from '#cli/tools/installers/credentials.ts';
import { runInstallStep, runRequiredInstallStep } from '#cli/tools/installers/steps.ts';
import { buildMiseTrust, readMiseBinPaths, readToolBinPaths } from '#cli/tools/locate.ts';
import { findMisePin, findMissingBuild, listMisePins, listPackagePins } from '#cli/tools/pins.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import type { GeneratedFile, MiseInstall, MiseLockfile, MiseToolPin, ToolInstall } from '#cli/types/tools.ts';

function selectMiseTools(install: ToolInstall) {
    const { session, tools, checkTools } = install;
    const configurations = session.toolConfigurations;
    const host = readHost();
    const hookTools = tools.filter(
        (tool) =>
            checkTools.has(tool.name) && findMissingBuild(tool, host) === undefined && findMisePin(tool) !== undefined,
    );
    const toolNamesByPin = new Map(hookTools.map((tool) => [findMisePin(tool)?.name, tool.name]));
    const pins = listMisePins(configurations).filter(
        (pin) =>
            toolNamesByPin.has(pin.name) || (pin.name === UV_TOOL && listPackagePins(configurations).python.length > 0),
    );
    return { pins, hookTools, toolNamesByPin };
}

function isGithubLimit(result: Pick<SpawnResult, 'stdout' | 'stderr'>): boolean {
    return GITHUB_RATE_LIMIT.test(`${result.stdout}\n${result.stderr}`);
}

function getMiseProject(install: ToolInstall): GeneratedFile {
    const [project] = install.generated.files.filter(({ path }) => path === GSPOT_PATHS.miseProject) as [GeneratedFile];
    return project;
}

async function runMiseInstall(install: ToolInstall, command: string[]): Promise<void> {
    const { root } = install.session;
    const trust = buildMiseTrust(root, getMiseProject(install).content);
    if ('refusal' in trust) throw new GspotError('install', trust.refusal);
    await runRequiredInstallStep(install, command, {
        cwd: join(root, GSPOT_FOLDER),
        env: { ...MISE_LOCKED_ENVIRONMENT, ...trust.variables },
        step: `installing mise tools from ${GSPOT_PATHS.miseProject}`,
        name: `The command ${command.join(' ')}`,
        readAdvice: (result) => (isGithubLimit(result) ? GITHUB_TOKEN_MESSAGE : NETWORK_ADVICE),
    });
}

function isReleaseAddress(address: unknown): boolean {
    if (typeof address !== 'string') return false;
    const url = URL.parse(address);
    return url?.protocol === MISE_RELEASE_PROTOCOL && MISE_RELEASE_HOSTS.has(url.hostname);
}

function isLockedRelease(pin: MiseToolPin, locked: object): boolean {
    const platforms = Object.entries(locked).filter(([name]) => name.startsWith(MISE_PLATFORM_PREFIX));
    if (platforms.length === 0) return false;
    return platforms.every(([name, value]) => {
        const audited = pin.checksums[name.slice(MISE_PLATFORM_PREFIX.length)];
        return (
            isTable(value) &&
            audited !== undefined &&
            audited === value['checksum'] &&
            isReleaseAddress(value['url']) &&
            (value['url_api'] === undefined || isReleaseAddress(value['url_api']))
        );
    });
}

function writeChecksums(lockfile: string, pins: MiseToolPin[]): string {
    const document = parseMiseLockfile(lockfile);
    if (document === undefined)
        throw new GspotError('install', 'mise lock produced no tool records. Run gspot install again.');
    for (const pin of pins) {
        const versions = document.tools[pin.name] ?? [];
        for (const version of versions) if (version.version === pin.version) fillVersionChecksums(version, pin);
    }
    return patch(lockfile, document);
}

function parseMiseLockfile(lockfile: string): MiseLockfile | undefined {
    return tryParseFile(() => parseTomlFile(GSPOT_PATHS.miseLockfile, lockfile, miseLockfileSchema));
}

async function writeMiseLockfile(install: ToolInstall, project: GeneratedFile): Promise<void> {
    const pins = listMisePins(install.session.toolConfigurations);
    const saved = install.writer.read(GSPOT_PATHS.miseLockfile);
    const savedText = saved?.bytes.toString('utf8');
    if (isMiseLockfileFresh(pins, savedText)) return;
    using scratch = createTemporaryFolder();
    writeFileSync(join(scratch.path, MISE_CONFIG_FILE), project.content);
    if (savedText !== undefined && parseMiseLockfile(savedText) !== undefined)
        writeFileSync(join(scratch.path, MISE_LOCKFILE), savedText);
    const result = await runInstallStep(install, MISE_LOCK_ARGUMENTS, {
        step: `locking the mise tools in ${GSPOT_PATHS.miseLockfile}`,
        cwd: scratch.path,
        env: {
            ...MISE_LOCK_ENVIRONMENT,
            [MISE_TRUSTED_PATHS_VARIABLE]: scratch.path,
            [MISE_CEILING_PATHS_VARIABLE]: dirname(scratch.path),
        },
    });
    const output = redactInstallOutput(result, []);
    const tokenAdvice = isGithubLimit(result) ? `\n${GITHUB_TOKEN_MESSAGE}` : '';
    if (result.code !== 0)
        throw new GspotError(
            'install',
            `The command ${MISE_LOCK_ARGUMENTS.join(' ')} failed (exit ${String(result.code)}):\n${output}${tokenAdvice}`,
        );
    const content = writeChecksums(readFileSync(join(scratch.path, MISE_LOCKFILE), 'utf8'), pins);
    const missing = pins.filter((pin) => !isMiseLockfileFresh([pin], content));
    const names = missing.map((pin) => `${pin.name} ${pin.version}`).join(', ');
    if (missing.length > 0)
        throw new GspotError('install', `mise lock did not lock ${names}.\n${output}${tokenAdvice}`);
    writePlans(
        install.writer,
        planReplacements(install.writer, [
            {
                path: GSPOT_PATHS.miseLockfile,
                next: { bytes: Buffer.from(content), mode: OWNER_WRITABLE_FILE },
                previous: saved,
            },
        ]),
    );
}

function fillVersionChecksums(version: Record<string, unknown>, pin: MiseToolPin): void {
    for (const [name, platform] of Object.entries(version)) {
        if (
            !name.startsWith(MISE_PLATFORM_PREFIX) ||
            !isTable(platform) ||
            (typeof platform['checksum'] === 'string' && MISE_CHECKSUM_PATTERN.test(platform['checksum']))
        )
            continue;
        const system = name.slice(MISE_PLATFORM_PREFIX.length);
        const checksum = pin.checksums[system];
        if (checksum === undefined)
            throw new GspotError(
                'install',
                `mise lock omitted a checksum for ${pin.name} on ${system}. Add an audited installer checksum before retrying.`,
            );
        platform['checksum'] = checksum;
    }
}

/**
Compare the mise pins with the versions recorded in the mise lockfile. Each locked download must come from a release
host over HTTPS, and each locked checksum must equal the audited checksum of the pin on that platform.
*/
export function isMiseLockfileFresh(pins: MiseToolPin[], lockfile: string | undefined): boolean {
    if (pins.length === 0) return true;
    const parsed = lockfile === undefined ? undefined : parseMiseLockfile(lockfile);
    if (parsed === undefined) return false;
    return pins.every(
        (pin) =>
            parsed.tools[pin.name]?.some((locked) => locked.version === pin.version && isLockedRelease(pin, locked)) ===
            true,
    );
}

export async function installMiseTools(install: ToolInstall): Promise<MiseInstall> {
    const { session, misePath, steps } = install;
    const { pins, hookTools, toolNamesByPin } = selectMiseTools(install);
    if (misePath === undefined) {
        const missing = pins.flatMap((pin) => {
            const name = pin.name === UV_TOOL ? UV_TOOL : getRequired(toolNamesByPin, pin.name, 'mise tool');
            return findProgram(name) === undefined ? [`${name} ${pin.version}`] : [];
        });
        const note = missing.length === 0 ? '' : `Install mise, or install these tools yourself: ${missing.join(', ')}`;
        return { installed: '', note, binPaths: [], tools: [] };
    }
    const project = getMiseProject(install);
    if (listMisePins(session.toolConfigurations).length > 0) await writeMiseLockfile(install, project);
    if (pins.length === 0) {
        const { folders, failure = '' } = await readToolBinPaths(session);
        return { installed: '', note: failure, binPaths: folders, tools: [] };
    }
    await runMiseInstall(install, [...MISE_INSTALL_ARGUMENTS, ...pins.map((pin) => pin.name)]);
    const names = pins.map((pin) => pin.name);
    steps.push([...MISE_BIN_PATHS_ARGUMENTS, ...names]);
    const { folders, failure = '' } = await readMiseBinPaths(session.root, names, {
        timeoutSeconds: session.settings.tool_timeout_seconds,
        project: project.content,
    });
    return {
        installed: `installed ${formatCount(names.length, MISE_TOOL_NOUN)} with mise`,
        note: failure,
        binPaths: folders,
        tools: hookTools,
    };
}

export async function reinstallMiseTools(install: ToolInstall, pins: MiseToolPin[]): Promise<void> {
    if (pins.length === 0) return;
    const versions = pins.map((pin) => `${pin.name}@${pin.version}`);
    await runMiseInstall(install, [...MISE_INSTALL_ARGUMENTS, MISE_FORCE_FLAG, ...versions]);
}
