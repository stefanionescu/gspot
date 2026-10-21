import which from 'which';
import { join } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import type { Session } from '#cli/types/planning.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import { findSystemSkip } from '#cli/planning/skips.ts';
import { readMiseBinPaths } from '#cli/tools/locate.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { redactInstallOutput } from '#cli/install/credentials.ts';
import { listRequiredTools } from '#cli/planning/needed-tools.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/find.ts';
import { MISE_TRUST_ARGUMENTS, MISE_INSTALL_ARGUMENTS } from '#cli/config/install.ts';
import { findMisePin, listMisePins, findMissingBuild, listToolProjectPins } from '#cli/configurations/tools.ts';

// Keep only the programs that hooks need for checks that can run on this system.
function selectHookPrograms(session: Session, tools: ToolDeclaration[]) {
    const manifests = session.neededToolManifests;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const programNames = new Set(
        session.configuredChecks
            .filter(
                (planned) =>
                    (planned.check.stage === 'commit' || planned.check.stage === 'push') &&
                    findSystemSkip(planned.check, planned.tool, host) === undefined,
            )
            .flatMap((planned) => listRequiredTools(planned)),
    );
    const programs = tools.filter(
        (tool) =>
            programNames.has(tool.name) &&
            findMissingBuild(tool, host) === undefined &&
            findMisePin(tool) !== undefined,
    );
    const pins = listMisePins(manifests).filter(
        (pin) =>
            programs.some((tool) => findMisePin(tool)?.name === pin.name) ||
            (pin.name === UV_TOOL && listToolProjectPins(manifests).python.length > 0),
    );
    return { pins, programs };
}

/**
 * Install the mise programs, and read their executable folders again.
 *
 * @param context what install needs for this step.
 *
 * @returns the note about missing programs.
 */
export async function installMiseTools(context: InstallContext): Promise<string> {
    const { session, tools, mise, steps } = context;
    const timeoutSeconds = session.timeoutSeconds;
    const { pins, programs } = selectHookPrograms(session, tools);
    if (mise === null) {
        const missing = pins.flatMap((pin) => {
            const name =
                pin.name === UV_TOOL
                    ? UV_TOOL
                    : (programs.find((tool) => findMisePin(tool)?.name === pin.name) as ToolDeclaration).name;
            return which.sync(name, { nothrow: true }) === null ? [`${name} ${pin.version}`] : [];
        });
        return missing.length === 0 ? '' : `Install mise, or install these programs yourself: ${missing.join(', ')}`;
    }
    if (pins.length === 0) return '';
    const commands = [
        { command: MISE_TRUST_ARGUMENTS, cwd: session.root },
        { command: [...MISE_INSTALL_ARGUMENTS, ...pins.map((pin) => pin.name)], cwd: join(session.root, DOT_GSPOT) },
    ];
    for (const { command, cwd } of commands) {
        const result = await runInstallStep(context, command, { cwd });
        if (result.code !== 0)
            throw new GspotError(
                'installation',
                `The command ${command.join(' ')} failed (exit ${String(result.code)}):\n${redactInstallOutput(result, [])}`,
            );
    }
    const names = pins.map((pin) => pin.name);
    steps.push([...MISE_BIN_PATHS_ARGUMENTS, ...names]);
    session.miseBinPaths = readMiseBinPaths(session.root, names, timeoutSeconds);
    delete session.uvPath;
    return 'trusted .gspot/mise.toml for mise';
}
