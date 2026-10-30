import which from 'which';
import { join, dirname } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { UV_TOOL } from '#cli/config/tools/uv.ts';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { findSystemSkip } from '#cli/planning/skips.ts';
import { listCheckTools } from '#cli/planning/tools.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import type { MiseInstall } from '#cli/types/installers/mise.ts';
import type { Tool, MiseToolPin } from '#cli/types/manifests.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import { redactInstallOutput } from '#cli/installers/credentials.ts';
import { miseLockfileSchema } from '#cli/schemas/installers/mise.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import { MISE_LOCKFILE, MISE_CONFIG_FILE } from '#cli/config/files/names.ts';
import { runInstallStep, runRequiredInstallStep } from '#cli/installers/steps.ts';
import { buildMiseTrust, readMiseBinPaths, readToolBinPaths } from '#cli/tools/locate.ts';
import { findMisePin, listMisePins, findMissingBuild, listToolProjectPins } from '#cli/manifests/tools.ts';

import {
    MISE_BIN_PATHS_ARGUMENTS,
    MISE_CEILING_PATHS_VARIABLE,
    MISE_TRUSTED_PATHS_VARIABLE,
} from '#cli/config/tools/locate.ts';
import {
    MISE_TOOL_NOUN,
    GITHUB_RATE_LIMIT,
    MISE_RELEASE_HOSTS,
    MISE_LOCK_ARGUMENTS,
    GITHUB_TOKEN_MESSAGE,
    MISE_PLATFORM_PREFIX,
    MISE_PROJECT_MESSAGE,
    MISE_CHECKSUM_PATTERN,
    MISE_RELEASE_PROTOCOL,
    MISE_INSTALL_ARGUMENTS,
    MISE_LOCKED_ENVIRONMENT,
} from '#cli/config/installers/mise.ts';

function selectMiseTools(session: Session, tools: Tool[]) {
    const configurations = session.toolConfigurations;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const toolNames = new Set(
        session.configuredChecks
            .filter((planned) => findSystemSkip(planned.check, planned.tool, host) === undefined)
            .flatMap((planned) => listCheckTools(planned)),
    );
    const hookTools = tools.filter(
        (tool) =>
            toolNames.has(tool.name) && findMissingBuild(tool, host) === undefined && findMisePin(tool) !== undefined,
    );
    const pins = listMisePins(configurations).filter(
        (pin) =>
            hookTools.some((tool) => findMisePin(tool)?.name === pin.name) ||
            (pin.name === UV_TOOL && listToolProjectPins(configurations).python.length > 0),
    );
    return { pins, hookTools };
}

function isReleaseAddress(address: unknown): boolean {
    if (typeof address !== 'string') return false;
    const url = URL.parse(address);
    return url?.protocol === MISE_RELEASE_PROTOCOL && MISE_RELEASE_HOSTS.has(url.hostname);
}

function isAuditedChecksum(pin: MiseToolPin, platform: string, checksum: unknown): boolean {
    if (typeof checksum !== 'string' || !MISE_CHECKSUM_PATTERN.test(checksum)) return false;
    const audited = pin.checksums?.[platform.slice(MISE_PLATFORM_PREFIX.length)];
    return audited === undefined || audited === checksum;
}

function isLockedRelease(pin: MiseToolPin, locked: object): boolean {
    const platforms = Object.entries(locked).filter(([name]) => name.startsWith(MISE_PLATFORM_PREFIX));
    if (platforms.length === 0) return false;
    return platforms.every(
        ([name, value]) =>
            isTable(value) &&
            isAuditedChecksum(pin, name, value['checksum']) &&
            isReleaseAddress(value['url']) &&
            (value['url_api'] === undefined || isReleaseAddress(value['url_api'])),
    );
}

/**
Compare the mise pins with the versions recorded in the mise lockfile. Each locked download must come from a release
host over HTTPS, and each locked checksum must equal the audited checksum of the pin where it has one.

@param pins the mise pins of the configurations in use.
@param lockfile the recorded lockfile, if present.
*/
export function isMiseLockfileFresh(pins: MiseToolPin[], lockfile: string | undefined): boolean {
    if (pins.length === 0) return true;
    if (lockfile === undefined) return false;
    let parsed;
    try {
        parsed = miseLockfileSchema.safeParse(parseTomlFile(GSPOT_PATHS.miseLockfile, lockfile));
    } catch (error) {
        if (!(error instanceof GspotError) || error.code !== 'parse') throw error;
        return false;
    }
    if (!parsed.success) return false;
    return pins.every(
        (pin) =>
            parsed.data.tools[pin.name]?.some(
                (locked) => locked.version === pin.version && isLockedRelease(pin, locked),
            ) === true,
    );
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

async function prepareMiseLockfile(install: ToolInstall, project: GeneratedFile): Promise<void> {
    const saved = install.writer.read(GSPOT_PATHS.miseLockfile);
    if (isMiseLockfileFresh(listMisePins(install.session.toolConfigurations), saved?.bytes.toString('utf8'))) return;
    using scratch = createTemporaryFolder();
    writeFileSync(join(scratch.path, MISE_CONFIG_FILE), project.content);
    if (saved !== undefined) writeFileSync(join(scratch.path, MISE_LOCKFILE), saved.bytes);
    const result = await runInstallStep(install, MISE_LOCK_ARGUMENTS, {
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
                expected: saved,
            },
        ]),
    );
}

/**
Install the mise tools, and read their executable folders.

@param install what install needs for this step.
@returns the line about the tools that mise installed, the note about missing tools, and the folders of the tools.
*/
export async function installMiseTools(install: ToolInstall): Promise<MiseInstall> {
    const { session, tools, misePath, steps } = install;
    const { pins, hookTools } = selectMiseTools(session, tools);
    if (misePath === null) {
        const missing = pins.flatMap((pin) => {
            const name =
                pin.name === UV_TOOL
                    ? UV_TOOL
                    : (hookTools.find((tool) => findMisePin(tool)?.name === pin.name) as Tool).name;
            return which.sync(name, { nothrow: true }) === null ? [`${name} ${pin.version}`] : [];
        });
        const note = missing.length === 0 ? '' : `Install mise, or install these tools yourself: ${missing.join(', ')}`;
        return { installed: '', note, binPaths: [] };
    }
    const [project] = install.generated.files.filter(({ path }) => path === GSPOT_PATHS.miseProject) as [GeneratedFile];
    if (listMisePins(session.toolConfigurations).length > 0) await prepareMiseLockfile(install, project);
    if (pins.length === 0) return { installed: '', note: '', binPaths: readToolBinPaths(session, project.content) };
    const trust = buildMiseTrust(session.root, project.content);
    if (trust === undefined) throw new GspotError('install', MISE_PROJECT_MESSAGE);
    const command = [...MISE_INSTALL_ARGUMENTS, ...pins.map((pin) => pin.name)];
    await runRequiredInstallStep(install, command, {
        cwd: join(session.root, GSPOT_FOLDER),
        env: { ...MISE_LOCKED_ENVIRONMENT, ...trust },
        name: `The command ${command.join(' ')}`,
    });
    const names = pins.map((pin) => pin.name);
    steps.push([...MISE_BIN_PATHS_ARGUMENTS, ...names]);
    return {
        installed: `installed ${formatCount(names.length, MISE_TOOL_NOUN)} with mise`,
        note: '',
        binPaths: readMiseBinPaths(session.root, names, {
            timeoutSeconds: session.timeoutSeconds,
            project: project.content,
        }),
    };
}

function fillVersionChecksums(version: Record<string, unknown>, pin: MiseToolPin): void {
    for (const [name, platform] of Object.entries(version)) {
        if (!name.startsWith(MISE_PLATFORM_PREFIX) || !isTable(platform)) continue;
        if (typeof platform['checksum'] === 'string' && MISE_CHECKSUM_PATTERN.test(platform['checksum'])) continue;
        const checksum = pin.checksums?.[name.slice(MISE_PLATFORM_PREFIX.length)];
        if (checksum === undefined)
            throw new GspotError(
                'install',
                `mise lock omitted a checksum for ${pin.name} on ${name.slice(MISE_PLATFORM_PREFIX.length)}. Add an audited installer checksum before retrying.`,
            );
        platform['checksum'] = checksum;
    }
}
