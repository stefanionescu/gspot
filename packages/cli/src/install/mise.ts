import which from 'which';
import { join } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import { systemSkip } from '#cli/planning/skips.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { type Session } from '#cli/types/planning.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { type InstallContext } from '#cli/types/install.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { redactInstallOutput } from '#cli/tools/credentials.ts';
import { requiredToolNames } from '#cli/planning/needed-tools.ts';
import { type ToolDeclaration } from '#cli/types/configurations.ts';
import { locateCandidates, readMiseBinPaths } from '#cli/tools/locate.ts';
import { MISE_TRUST_ARGUMENTS, MISE_INSTALL_ARGUMENTS } from '#cli/config/install.ts';
import { pinOf, misePins, missingBuild, toolProjectPins } from '#cli/configurations/tool-pins.ts';

// Select only programs required by checks this operating system can run in hooks.
function installationPrograms(session: Session, tools: ToolDeclaration[]) {
    const manifests = session.neededToolManifests;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const programNames = new Set(
        session.configuredChecks
            .filter(
                (planned) =>
                    (planned.check.stage === 'commit' || planned.check.stage === 'push') &&
                    systemSkip(planned.check, planned.tool, host) === undefined,
            )
            .flatMap((planned) => requiredToolNames(planned)),
    );
    const programs = tools.filter(
        (tool) =>
            programNames.has(tool.name) &&
            missingBuild(tool, host.platform, host.arch) === undefined &&
            pinOf(tool) !== undefined,
    );
    const pins = misePins(manifests).filter(
        (pin) =>
            programs.some((tool) => pinOf(tool)?.name === pin.name) ||
            (pin.name === UV_TOOL && toolProjectPins(manifests).python.length > 0),
    );
    return { pins, programs };
}

/**
 * Install selected mise programs and refresh their actual executable directories.
 *
 * @param context the selected tools, session, writer, generated files, and attempted commands.
 *
 * @returns the installation note for missing program tools.
 */
export async function installMiseTools(context: InstallContext): Promise<string> {
    const { session, tools, mise, steps } = context;
    const timeoutSeconds = session.timeoutSeconds;
    const { pins, programs } = installationPrograms(session, tools);
    if (mise === null) {
        const missing = pins.flatMap((pin) => {
            const name =
                pin.name === UV_TOOL
                    ? UV_TOOL
                    : (programs.find((tool) => pinOf(tool)?.name === pin.name) as ToolDeclaration).name;
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
        steps.push(command);
        const result = await runTool(command, {
            cwd,
            timeoutSeconds,
        });
        if (result.code !== 0)
            throw new GspotError(
                'installation',
                `The command ${command.join(' ')} failed (exit ${String(result.code)}):\n${redactInstallOutput(result, [])}`,
            );
    }
    session.miseBinPaths = readMiseBinPaths(
        session.root,
        pins.map((pin) => pin.name),
        timeoutSeconds,
        steps,
    );
    session.uvPath =
        locateCandidates(session.root, UV_TOOL, {
            searchFolders: [],
            miseBinPaths: session.miseBinPaths,
            timeoutSeconds,
        })[0] ?? UV_TOOL;
    return '';
}
