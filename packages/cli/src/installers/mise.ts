import which from 'which';
import { join } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { UV_TOOL } from '#cli/config/tools/uv.ts';
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
import { runRequiredInstallStep } from '#cli/installers/steps.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import { redactInstallOutput } from '#cli/installers/credentials.ts';
import { miseLockfileSchema } from '#cli/schemas/installers/mise.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import type { Tool, MiseToolPin } from '#cli/types/configurations.ts';
import { MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/locate.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import { readMiseBinPaths, readToolBinPaths } from '#cli/tools/locate.ts';
import { MISE_LOCKFILE, MISE_CONFIG_FILE } from '#cli/config/files/names.ts';
import { findMisePin, listMisePins, findMissingBuild, listToolProjectPins } from '#cli/configurations/tools.ts';

import {
    MISE_TRUST_NOTE,
    MISE_LOCK_ARGUMENTS,
    MISE_TRUST_ARGUMENTS,
    MISE_PLATFORM_PREFIX,
    MISE_CHECKSUM_PATTERN,
    MISE_INSTALL_ARGUMENTS,
    MISE_LOCKED_ENVIRONMENT,
    MISE_TRUSTED_PATHS_VARIABLE,
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

function hasMiseChecksums(locked: object): boolean {
    const platforms = Object.entries(locked).filter(([name]) => name.startsWith(MISE_PLATFORM_PREFIX));
    if (platforms.length === 0) return false;
    return platforms.every(
        ([, value]) =>
            isTable(value) &&
            typeof value['url'] === 'string' &&
            typeof value['checksum'] === 'string' &&
            MISE_CHECKSUM_PATTERN.test(value['checksum']),
    );
}

/**
Compare the mise pins with the versions recorded in the mise lockfile.

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
                (locked) => locked.version === pin.version && hasMiseChecksums(locked),
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

async function prepareMiseLockfile(install: ToolInstall): Promise<void> {
    const [project] = install.generated.files.filter(({ path }) => path === GSPOT_PATHS.miseProject) as [GeneratedFile];
    const saved = install.writer.read(GSPOT_PATHS.miseLockfile);
    if (isMiseLockfileFresh(listMisePins(install.session.toolConfigurations), saved?.bytes.toString('utf8'))) return;
    using scratch = createTemporaryFolder();
    writeFileSync(join(scratch.path, MISE_CONFIG_FILE), project.content);
    if (saved !== undefined) writeFileSync(join(scratch.path, MISE_LOCKFILE), saved.bytes);
    const result = await runRequiredInstallStep(install, MISE_LOCK_ARGUMENTS, {
        cwd: scratch.path,
        env: { [MISE_TRUSTED_PATHS_VARIABLE]: scratch.path },
        name: `The command ${MISE_LOCK_ARGUMENTS.join(' ')}`,
    });
    const output = redactInstallOutput(result, []);
    const content = writeChecksums(
        readFileSync(join(scratch.path, MISE_LOCKFILE), 'utf8'),
        listMisePins(install.session.toolConfigurations),
    );
    const missing = listMisePins(install.session.toolConfigurations).filter(
        (pin) => !isMiseLockfileFresh([pin], content),
    );
    const names = missing.map((pin) => `${pin.name} ${pin.version}`).join(', ');
    if (missing.length > 0) throw new GspotError('install', `mise lock did not lock ${names}.\n${output}`);
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
@returns the trust note, or the note about missing programs, and the folders of the programs that mise installed.
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
        return { note, binPaths: [] };
    }
    if (listMisePins(session.toolConfigurations).length > 0) await prepareMiseLockfile(install);
    if (pins.length === 0) return { note: '', binPaths: readToolBinPaths(session) };
    const commands = [
        { command: MISE_TRUST_ARGUMENTS, cwd: session.root, env: {} },
        {
            command: [...MISE_INSTALL_ARGUMENTS, ...pins.map((pin) => pin.name)],
            cwd: join(session.root, GSPOT_FOLDER),
            env: MISE_LOCKED_ENVIRONMENT,
        },
    ];
    for (const { command, cwd, env } of commands)
        await runRequiredInstallStep(install, command, { cwd, env, name: `The command ${command.join(' ')}` });
    const names = pins.map((pin) => pin.name);
    steps.push([...MISE_BIN_PATHS_ARGUMENTS, ...names]);
    return {
        note: MISE_TRUST_NOTE,
        binPaths: readMiseBinPaths(session.root, names, session.timeoutSeconds),
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
