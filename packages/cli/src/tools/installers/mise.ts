import which from 'which';
import { join, dirname } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from '@decimalturn/toml-patch';
import { miseLockfileSchema } from '#cli/schemas/tools.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import { redactInstallOutput } from '#cli/tools/installers/credentials.ts';
import { GSPOT_PATHS, MISE_LOCKFILE, MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { runInstallStep, runRequiredInstallStep } from '#cli/tools/installers/steps.ts';
import { buildMiseTrust, readMiseBinPaths, readToolBinPaths } from '#cli/tools/locate.ts';
import { findMisePin, listMisePins, listPackagePins, findMissingBuild } from '#cli/tools/pins.ts';
import type { MiseToolPin, MiseInstall, ToolInstall, MiseLockfile, GeneratedFile } from '#cli/types/tools.ts';

import {
    UV_TOOL,
    MISE_TOOL_NOUN,
    MISE_FORCE_FLAG,
    GITHUB_RATE_LIMIT,
    MISE_RELEASE_HOSTS,
    MISE_LOCK_ARGUMENTS,
    GITHUB_TOKEN_MESSAGE,
    MISE_PLATFORM_PREFIX,
    MISE_CHECKSUM_PATTERN,
    MISE_RELEASE_PROTOCOL,
    MISE_INSTALL_ARGUMENTS,
    MISE_LOCKED_ENVIRONMENT,
    MISE_BIN_PATHS_ARGUMENTS,
    MISE_CEILING_PATHS_VARIABLE,
    MISE_TRUSTED_PATHS_VARIABLE,
} from '#cli/config/tools/installers.ts';

function selectMiseTools(install: ToolInstall) {
    const { session, tools, checkTools } = install;
    const configurations = session.toolConfigurations;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const hookTools = tools.filter(
        (tool) =>
            checkTools.has(tool.name) && findMissingBuild(tool, host) === undefined && findMisePin(tool) !== undefined,
    );
    const pins = listMisePins(configurations).filter(
        (pin) =>
            hookTools.some((tool) => findMisePin(tool)?.name === pin.name) ||
            (pin.name === UV_TOOL && listPackagePins(configurations).python.length > 0),
    );
    return { pins, hookTools };
}

async function runMiseInstall(install: ToolInstall, command: string[]): Promise<void> {
    const { root } = install.session;
    const [project] = install.generated.files.filter(({ path }) => path === GSPOT_PATHS.miseProject) as [GeneratedFile];
    const trust = buildMiseTrust(root, project.content);
    if ('refusal' in trust) throw new GspotError('install', trust.refusal);
    await runRequiredInstallStep(install, command, {
        cwd: join(root, GSPOT_FOLDER),
        env: { ...MISE_LOCKED_ENVIRONMENT, ...trust.variables },
        step: `installing mise tools from ${GSPOT_PATHS.miseProject}`,
        name: `The command ${command.join(' ')}`,
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
    const document = parse(lockfile) as Record<string, unknown>;
    const tools = document['tools'];
    if (!isTable(tools))
        throw new GspotError('install', 'mise lock produced no tool records. Run gspot install again.');
    for (const pin of pins) {
        const versions = tools[pin.name];
        if (!Array.isArray(versions)) continue;
        const selected = versions.filter(
            (version): version is Record<string, unknown> => isTable(version) && version['version'] === pin.version,
        );
        for (const version of selected) {
            fillVersionChecksums(version, pin);
        }
    }
    return stringify(document);
}

function parseMiseLockfile(lockfile: string): MiseLockfile | undefined {
    try {
        return parseTomlFile(GSPOT_PATHS.miseLockfile, lockfile, miseLockfileSchema);
    } catch (error) {
        if (!(error instanceof GspotError) || error.code !== 'parse') throw error;
        return undefined;
    }
}

async function writeMiseLockfile(install: ToolInstall, project: GeneratedFile): Promise<void> {
    const saved = install.writer.read(GSPOT_PATHS.miseLockfile);
    const savedText = saved?.bytes.toString('utf8');
    if (isMiseLockfileFresh(listMisePins(install.session.toolConfigurations), savedText)) return;
    using scratch = createTemporaryFolder();
    writeFileSync(join(scratch.path, MISE_CONFIG_FILE), project.content);
    if (savedText !== undefined && parseMiseLockfile(savedText) !== undefined)
        writeFileSync(join(scratch.path, MISE_LOCKFILE), savedText);
    const result = await runInstallStep(install, MISE_LOCK_ARGUMENTS, {
        step: `locking the mise tools in ${GSPOT_PATHS.miseLockfile}`,
        cwd: scratch.path,
        env: {
            [MISE_TRUSTED_PATHS_VARIABLE]: scratch.path,
            [MISE_CEILING_PATHS_VARIABLE]: dirname(scratch.path),
        },
    });
    const output = redactInstallOutput(result, []);
    const tokenAdvice = GITHUB_RATE_LIMIT.test(output) ? `\n${GITHUB_TOKEN_MESSAGE}` : '';
    if (result.code !== 0)
        throw new GspotError(
            'install',
            `The command ${MISE_LOCK_ARGUMENTS.join(' ')} failed (exit ${String(result.code)}):\n${output}${tokenAdvice}`,
        );
    const content = writeChecksums(
        readFileSync(join(scratch.path, MISE_LOCKFILE), 'utf8'),
        listMisePins(install.session.toolConfigurations),
    );
    const missing = listMisePins(install.session.toolConfigurations).filter(
        (pin) => !isMiseLockfileFresh([pin], content),
    );
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
        if (!name.startsWith(MISE_PLATFORM_PREFIX) || !isTable(platform)) continue;
        if (typeof platform['checksum'] === 'string' && MISE_CHECKSUM_PATTERN.test(platform['checksum'])) continue;
        const checksum = pin.checksums[name.slice(MISE_PLATFORM_PREFIX.length)];
        if (checksum === undefined)
            throw new GspotError(
                'install',
                `mise lock omitted a checksum for ${pin.name} on ${name.slice(MISE_PLATFORM_PREFIX.length)}. Add an audited installer checksum before retrying.`,
            );
        platform['checksum'] = checksum;
    }
}

/**
Compare the mise pins with the versions recorded in the mise lockfile. Each locked download must come from a release
host over HTTPS, and each locked checksum must equal the audited checksum of the pin on that platform.

@param pins the mise pins of the configurations in use.
@param lockfile the recorded lockfile, if present.
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

/**
Install the mise tools, and read their executable folders.

@param install what install needs for this step.
@returns the line about the tools that mise installed, the note about missing tools, and the folders of the tools.
*/
export async function installMiseTools(install: ToolInstall): Promise<MiseInstall> {
    const { session, misePath, steps } = install;
    const { pins, hookTools } = selectMiseTools(install);
    if (misePath === undefined) {
        const missing = pins.flatMap((pin) => {
            const name =
                pin.name === UV_TOOL
                    ? UV_TOOL
                    : (hookTools.find((tool) => findMisePin(tool)?.name === pin.name) as Tool).name;
            return which.sync(name, { nothrow: true }) === null ? [`${name} ${pin.version}`] : [];
        });
        const note = missing.length === 0 ? '' : `Install mise, or install these tools yourself: ${missing.join(', ')}`;
        return { installed: '', note, binPaths: [], tools: [] };
    }
    const [project] = install.generated.files.filter(({ path }) => path === GSPOT_PATHS.miseProject) as [GeneratedFile];
    if (listMisePins(session.toolConfigurations).length > 0) await writeMiseLockfile(install, project);
    if (pins.length === 0) {
        const { folders, failure = '' } = await readToolBinPaths(session);
        return { installed: '', note: failure, binPaths: folders, tools: [] };
    }
    await runMiseInstall(install, [...MISE_INSTALL_ARGUMENTS, ...pins.map((pin) => pin.name)]);
    const names = pins.map((pin) => pin.name);
    steps.push([...MISE_BIN_PATHS_ARGUMENTS, ...names]);
    const { folders, failure = '' } = await readMiseBinPaths(session.root, names, {
        timeoutSeconds: session.timeoutSeconds,
        project: project.content,
    });
    return {
        installed: `installed ${formatCount(names.length, MISE_TOOL_NOUN)} with mise`,
        note: failure,
        binPaths: folders,
        tools: hookTools,
    };
}

/**
Install the mise tools again over what the mise install folder holds.

@param install what install needs for this step.
@param pins the mise pins to install again.
*/
export async function reinstallMiseTools(install: ToolInstall, pins: MiseToolPin[]): Promise<void> {
    if (pins.length === 0) return;
    const versions = pins.map((pin) => `${pin.name}@${pin.version}`);
    await runMiseInstall(install, [...MISE_INSTALL_ARGUMENTS, MISE_FORCE_FLAG, ...versions]);
}
