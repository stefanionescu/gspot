import which from 'which';
import { join } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import { findSystemSkip } from '#cli/planning/skips.ts';
import { readMiseBinPaths } from '#cli/tools/locate.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { listNeededTools } from '#cli/planning/needed-tools.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { redactInstallOutput } from '#cli/install/credentials.ts';
import { MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/inspection.ts';
import { MISE_TRUST_ARGUMENTS, MISE_INSTALL_ARGUMENTS } from '#cli/config/install/mise.ts';

import {
    findMisePin,
    listMisePins,
    findMissingBuild,
    listToolProjectPins,
} from '#cli/configurations/declared-tools.ts';

// Keep only the programs that hooks need for checks that can run on this system.
function selectHookTools(session: Session, tools: Tool[]) {
    const configurations = session.neededToolConfigurations;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const toolNames = new Set(
        session.configuredChecks
            .filter(
                (planned) =>
                    (planned.check.stage === 'commit' || planned.check.stage === 'push') &&
                    findSystemSkip(planned.check, planned.tool, host) === undefined,
            )
            .flatMap((planned) => listNeededTools(planned)),
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

/**
 * Install the mise tools, and read their executable folders again.
 *
 * @param install what install needs for this step.
 *
 * @returns the note about missing programs.
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
    if (pins.length === 0) return '';
    const commands = [
        { command: MISE_TRUST_ARGUMENTS, cwd: session.root },
        { command: [...MISE_INSTALL_ARGUMENTS, ...pins.map((pin) => pin.name)], cwd: join(session.root, DOT_GSPOT) },
    ];
    for (const { command, cwd } of commands) {
        const result = await runInstallStep(install, command, { cwd });
        if (result.code !== 0)
            throw new GspotError(
                'install',
                `The command ${command.join(' ')} failed (exit ${String(result.code)}):\n${redactInstallOutput(result, [])}`,
            );
    }
    const names = pins.map((pin) => pin.name);
    steps.push([...MISE_BIN_PATHS_ARGUMENTS, ...names]);
    session.miseBinPaths = readMiseBinPaths(session.root, names, timeoutSeconds);
    delete session.uvPath;
    return 'trusted .gspot/mise.toml for mise';
}
