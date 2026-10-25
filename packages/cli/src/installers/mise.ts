import which from 'which';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from '@decimalturn/toml-patch';
import { isTable } from '#cli/system/tables.ts';
import { UV_TOOL } from '#cli/config/tools/uv.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { findSystemSkip } from '#cli/planning/skips.ts';
import { listCheckTools } from '#cli/planning/tools.ts';
import { writePlans, planReplacements } from '#cli/write.ts';
import { downloadArchive } from '#cli/installers/downloads.ts';
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
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { readMiseBinPaths, readToolBinPaths } from '#cli/tools/locate.ts';
import { MISE_LOCK_FILE, MISE_CONFIG_FILE } from '#cli/config/files/names.ts';
import { MISE_TOOL, MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/locate.ts';
import { findMisePin, listMisePins, findMissingBuild, listToolProjectPins } from '#cli/configurations/tools.ts';

import {
    MISE_URL_LINE,
    MISE_CHECKSUM_LINE,
    MISE_ARCHIVE_LIMIT,
    MISE_LOCK_ARGUMENTS,
    MISE_PLATFORM_HEADER,
    MISE_TRUST_ARGUMENTS,
    MISE_PLATFORM_PREFIX,
    MISE_CHECKSUM_PATTERN,
    MISE_INSTALL_ARGUMENTS,
    MISE_LOCK_SECTION_START,
    MISE_LOCKED_ENVIRONMENT,
} from '#cli/config/installers/mise.ts';

function selectHookTools(session: Session, tools: Tool[]) {
    const configurations = session.toolConfigurations;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const toolNames = new Set(
        session.configuredChecks
            .filter(
                (planned) =>
                    (planned.check.stage === 'commit' || planned.check.stage === 'push') &&
                    findSystemSkip(planned.check, planned.tool, host) === undefined,
            )
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
@returns whether every tool has its exact locked version.
*/
export function isMiseLockfileFresh(pins: MiseToolPin[], lockfile: string | undefined): boolean {
    if (pins.length === 0) return true;
    if (lockfile === undefined) return false;
    let parsed;
    try {
        parsed = miseLockfileSchema.safeParse(parse(lockfile));
    } catch (error) {
        if (!(error instanceof Error && 'line' in error)) throw error;
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

async function addMissingChecksums(install: ToolInstall, lockfile: string, output: string): Promise<string> {
    const sections = await Promise.all(
        lockfile.split(MISE_LOCK_SECTION_START).map(async (section) => {
            const [header = '', ...lines] = section.split('\n');
            if (!MISE_PLATFORM_HEADER.test(header)) return section;
            const url = MISE_URL_LINE.exec(section)?.groups?.['url'];
            if (url === undefined)
                throw new GspotError(
                    'install',
                    `mise lock left a tool without a download URL, so gspot kept the existing files. Its output:\n${output}`,
                );
            if (MISE_CHECKSUM_LINE.test(section)) return section;
            const bytes = await downloadArchive(install, {
                url,
                name: 'the mise tool archive',
                limit: MISE_ARCHIVE_LIMIT,
            });
            return [header, `checksum = "sha256:${createHash('sha256').update(bytes).digest('hex')}"`, ...lines].join(
                '\n',
            );
        }),
    );
    return sections.join('');
}

async function prepareMiseLockfile(install: ToolInstall): Promise<void> {
    const [project] = install.generated.files.filter(({ path }) => path === GSPOT_PATHS.miseProject) as [GeneratedFile];
    const saved = install.writer.read(GSPOT_PATHS.miseLockfile);
    if (isMiseLockfileFresh(listMisePins(install.session.toolConfigurations), saved?.bytes.toString('utf8'))) return;
    using scratch = createTemporaryFolder();
    writeFileSync(join(scratch.path, MISE_CONFIG_FILE), project.content);
    if (saved !== undefined) writeFileSync(join(scratch.path, MISE_LOCK_FILE), saved.bytes);
    let output = '';
    for (const command of [[MISE_TOOL, 'trust', join(scratch.path, MISE_CONFIG_FILE)], MISE_LOCK_ARGUMENTS]) {
        const result = await runRequiredInstallStep(install, command, {
            cwd: scratch.path,
            name: `The command ${command.join(' ')}`,
        });
        output = redactInstallOutput(result, []);
    }
    const content = await addMissingChecksums(
        install,
        readFileSync(join(scratch.path, MISE_LOCK_FILE), 'utf8'),
        output,
    );
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
    const { pins, hookTools } = selectHookTools(session, tools);
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
        note: 'trusted .gspot/mise.toml for mise',
        binPaths: readMiseBinPaths(session.root, names, session.timeoutSeconds),
    };
}
