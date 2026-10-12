import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { GspotError } from '#cli/errors.ts';
import { runTool } from '#cli/tools/run.ts';
import { readOwnershipLog } from '#cli/ownership/log.ts';
import type { ValeInstallation } from '#cli/types/install.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { VALE_INSTALL_ARGUMENTS } from '#cli/config/install.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { inspectTool, toolAvailability } from '#cli/tools/find.ts';
import { installationDiagnostics } from '#cli/tools/diagnostics.ts';
import { VALE_CONFIG, VALE_PACKAGE_DIRECTORY } from '#cli/config/system/locations.ts';

/**
 * Check upstream style availability before running prose checks.
 *
 * @param root the repository root.
 * @param level the selected check level.
 *
 * @returns whether the config and required package directories exist.
 */
export function hasValePackages(root: string, level: Settings['level']): boolean {
    using files = openSafeFolder(root);
    if (files.read(VALE_CONFIG) === undefined) return false;
    if (level === 'recommended') return true;
    const available = VALE_PACKAGE_FOLDERS.every(
        (name) => files.stat(`${VALE_PACKAGE_DIRECTORY}/${name}`)?.isDirectory() === true,
    );
    return available && readOwnershipLog(root).installed?.includes('vale') === true;
}

/**
 * Downloads the upstream packages shipped at the selected level, and replaces the installed ones with them. Needs the network.
 *
 * @param request the tool search, selected Vale pin, timeout, and cancellation.
 * @param steps the commands attempted during installation.
 *
 * @returns the installation summary.
 */
export async function installValePackages(request: ValeInstallation, steps: (readonly string[])[]): Promise<string> {
    const { search, tool, level, timeoutSeconds, cancelSignal } = request;
    if (level === 'recommended') return '';
    const { root } = search;
    if (cancelSignal?.aborted === true) throw new GspotError('installation', 'Vale sync was canceled.');
    const available = toolAvailability(tool, inspectTool(search, tool));
    if ('status' in available) throw new GspotError('tool', available.note);
    using files = openSafeFolder(root);
    files.removeTree(VALE_PACKAGE_DIRECTORY);
    const config = join(root, VALE_CONFIG);
    const command = [available.path, '--config', config, ...VALE_INSTALL_ARGUMENTS];
    steps.push(command);
    const result = await runTool(command, {
        cwd: dirname(config),
        cancelSignal,
        timeoutSeconds,
    });
    const failure = [
        { matches: result.isCanceled === true, message: 'Vale sync was canceled.' },
        {
            matches: result.isTimedOut === true,
            message: `Vale sync ran longer than tool_timeout_seconds (${String(timeoutSeconds)}s).`,
        },
        {
            matches: result.code !== 0,
            message: `Vale sync failed (exit ${String(result.code)}):\n${installationDiagnostics(result, [])}`,
        },
    ].find(({ matches }) => matches);
    if (failure !== undefined) throw new GspotError('installation', failure.message);
    const missing = VALE_PACKAGE_FOLDERS.find(
        (folder) =>
            statSync(join(root, VALE_PACKAGE_DIRECTORY, folder), { throwIfNoEntry: false })?.isDirectory() !== true,
    );
    if (missing !== undefined)
        throw new GspotError(
            'installation',
            `Vale did not install ${VALE_PACKAGE_DIRECTORY}/${missing}. Run: gspot install`,
        );
    return `installed Vale packages in ${VALE_PACKAGE_DIRECTORY}`;
}
