// Install and check the Vale packages.
import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import { join, dirname, resolve } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { InstallContext } from '#cli/types/install.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { redactInstallOutput } from '#cli/install/credentials.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { rmSync, mkdirSync, renameSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { DOT_GSPOT, VALE_PACKAGES_PATH, VALE_TOOL_FILE_PATH } from '#cli/config/system/locations.ts';
import { VALE_INSTALL_PREFIX, VALE_INSTALL_ARGUMENTS, VALE_STYLES_PATH_PATTERN } from '#cli/config/install.ts';

/**
 * Check that the upstream styles exist before prose checks run.
 *
 * @param repositoryRoot the root with the generated Vale files and style folders.
 * @param level recommended or all, which decides the packages.
 *
 * @returns whether the Vale settings and the package folders exist.
 */
export function hasValePackages(repositoryRoot: string, level: Settings['level']): boolean {
    using files = openFiles(repositoryRoot);
    if (files.read(VALE_TOOL_FILE_PATH) === undefined) return false;
    if (level === 'recommended') return true;
    return VALE_PACKAGE_FOLDERS.every(
        (name) => files.readStats(`${VALE_PACKAGES_PATH}/${name}`)?.isDirectory() === true,
    );
}

/**
 * Download the upstream packages for the level, and replace the installed ones. Needs the network.
 *
 * @param context what install needs for this step.
 *
 * @returns the install summary.
 */
export async function installValePackages(context: InstallContext): Promise<string> {
    const { session: search, steps } = context;
    const { root, timeoutSeconds } = search;
    const level = search.settingsFile.settings.level;
    if (level === 'recommended') return '';
    const tool = getToolDeclaration(search.neededToolManifests, 'vale');
    const available = buildToolAvailability(tool, inspectTool(search, tool));
    if ('status' in available) throw new GspotError('tool', available.note);
    using files = openFiles(root);
    const temporary = mkdtempSync(join(files.readRealPath(DOT_GSPOT), VALE_INSTALL_PREFIX));
    try {
        const config = join(temporary, VALE_TOOL_FILE_PATH);
        const text = readFileSync(files.readRealPath(VALE_TOOL_FILE_PATH), 'utf8');
        const last = [...text.matchAll(VALE_STYLES_PATH_PATTERN)].at(-1);
        const content = text.replaceAll(VALE_STYLES_PATH_PATTERN, (line, path: string, offset: number) =>
            offset === last?.index
                ? line
                : `StylesPath = ${convertToPosixPath(resolve(root, dirname(VALE_TOOL_FILE_PATH), path.trim()))}`,
        );
        mkdirSync(dirname(config), { recursive: true });
        writeFileSync(config, content);
        const command = [available.path, '--config', config, ...VALE_INSTALL_ARGUMENTS];
        steps.push(command);
        const result = await runTool(command, {
            cancelSignal: context.cancelSignal,
            cwd: dirname(config),
            timeoutSeconds,
        });
        context.cancelSignal?.throwIfAborted();
        const failure = [
            {
                matches: result.isTimedOut === true,
                message: `Vale sync ran longer than tool_timeout_seconds (${String(timeoutSeconds)}s).`,
            },
            {
                matches: result.code !== 0,
                message: `Vale sync failed (exit ${String(result.code)}):\n${redactInstallOutput(result, [])}`,
            },
        ].find(({ matches }) => matches);
        if (failure !== undefined) throw new GspotError('installation', failure.message);
        files.deleteTree(VALE_PACKAGES_PATH);
        renameSync(join(temporary, VALE_PACKAGES_PATH), join(root, VALE_PACKAGES_PATH));
        return `installed Vale packages in ${VALE_PACKAGES_PATH}`;
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
