import which from 'which';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from '@decimalturn/toml-patch';
import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { findSystemSkip } from '#cli/planning/skips.ts';
import { listCheckTools } from '#cli/planning/tools.ts';
import { readMiseBinPaths } from '#cli/tools/locate.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { downloadArchive } from '#cli/install/downloads.ts';
import { writePlans, planReplacement } from '#cli/write.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { runRequiredInstallStep } from '#cli/install/steps.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { redactInstallOutput } from '#cli/install/credentials.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { MISE_TOOL, MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/locate.ts';
import { miseProjectSchema, miseLockfileSchema } from '#cli/schemas/install/mise.ts';
import { findMisePin, listMisePins, findMissingBuild, listToolProjectPins } from '#cli/configurations/tools.ts';

import {
    MISE_URL_LINE,
    MISE_LOCK_FILE,
    MISE_CONFIG_FILE,
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
} from '#cli/config/install/mise.ts';

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
Compare the mise project pins with the versions recorded in its lockfile.

@param project the generated mise.toml.
@param lockfile the recorded lockfile, if present.
@returns whether every tool has its exact locked version.
*/
export function isMiseLockfileFresh(project: string, lockfile: string | undefined): boolean {
    const expected = parseTomlFile(GSPOT_PATHS.miseProject, project, miseProjectSchema).tools;
    if (Object.keys(expected).length === 0) return true;
    if (lockfile === undefined) return false;
    let parsed;
    try {
        parsed = miseLockfileSchema.safeParse(parse(lockfile));
    } catch (error) {
        if (!(error instanceof Error && 'line' in error)) throw error;
        return false;
    }
    if (!parsed.success) return false;
    return Object.entries(expected).every(
        ([name, pin]) =>
            parsed.data.tools[name]?.some(
                (locked) => locked.version === (isTable(pin) ? pin['version'] : pin) && hasMiseChecksums(locked),
            ) === true,
    );
}

async function addMissingChecksums(install: ToolInstall, lockfile: string): Promise<string> {
    const sections = await Promise.all(
        lockfile.split(MISE_LOCK_SECTION_START).map(async (section) => {
            const [header = '', ...lines] = section.split('\n');
            const url = MISE_URL_LINE.exec(section)?.groups?.['url'];
            if (!MISE_PLATFORM_HEADER.test(header) || url === undefined || MISE_CHECKSUM_LINE.test(section))
                return section;
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
    if (isMiseLockfileFresh(project.content, saved?.bytes.toString('utf8'))) return;
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
    const content = await addMissingChecksums(install, readFileSync(join(scratch.path, MISE_LOCK_FILE), 'utf8'));
    if (!isMiseLockfileFresh(project.content, content))
        throw new GspotError(
            'install',
            `mise lock left a tool without a download URL or checksum, so gspot kept the existing files. Its output:\n${output}`,
        );
    const lockfile: GeneratedFile = { path: GSPOT_PATHS.miseLockfile, content, kind: 'lock', read: saved };
    install.generated.files.push(lockfile);
    writePlans(install.writer, [
        planReplacement(install.writer, {
            path: lockfile.path,
            next: { bytes: Buffer.from(content), mode: OWNER_WRITABLE_FILE },
            expected: saved,
        }),
    ]);
}

/**
Install the mise tools, and read their executable folders again.

@param install what install needs for this step.
@returns the trust note, or the note about missing programs.
*/
export async function installMiseTools(install: ToolInstall): Promise<string> {
    const { session, tools, misePath, steps } = install;
    const timeoutSeconds = session.timeoutSeconds;
    const { pins, hookTools } = selectHookTools(session, tools);
    if (misePath === null) {
        const missing = pins.flatMap((pin) => {
            const name =
                pin.name === UV_TOOL
                    ? UV_TOOL
                    : (hookTools.find((tool) => findMisePin(tool)?.name === pin.name) as Tool).name;
            return which.sync(name, { nothrow: true }) === null ? [`${name} ${pin.version}`] : [];
        });
        return missing.length === 0 ? '' : `Install mise, or install these tools yourself: ${missing.join(', ')}`;
    }
    if (listMisePins(session.toolConfigurations).length > 0) await prepareMiseLockfile(install);
    if (pins.length === 0) return '';
    const commands = [
        { command: MISE_TRUST_ARGUMENTS, cwd: session.root, env: {} },
        {
            command: [...MISE_INSTALL_ARGUMENTS, ...pins.map((pin) => pin.name)],
            cwd: join(session.root, DOT_GSPOT),
            env: MISE_LOCKED_ENVIRONMENT,
        },
    ];
    for (const { command, cwd, env } of commands)
        await runRequiredInstallStep(install, command, { cwd, env, name: `The command ${command.join(' ')}` });
    const names = pins.map((pin) => pin.name);
    steps.push([...MISE_BIN_PATHS_ARGUMENTS, ...names]);
    session.miseBinPaths = readMiseBinPaths(session.root, names, timeoutSeconds);
    delete session.uvPath;
    return 'trusted .gspot/mise.toml for mise';
}
