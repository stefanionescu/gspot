// Install and check the Vale packages.
import { GspotError } from '#cli/system/errors.ts';
import { join, dirname, resolve } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import { readText } from '#cli/system/files/reads.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import { getMiseBinPaths } from '#cli/tools/locate.ts';
import { VALE_TOOL } from '#cli/config/checks/prose.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { redactInstallOutput } from '#cli/install/credentials.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { rmSync, mkdirSync, renameSync, mkdtempSync, writeFileSync } from 'node:fs';
import { DOT_GSPOT, VALE_PACKAGES_PATH, VALE_TOOL_FILE_PATH } from '#cli/config/gspot-paths.ts';

import {
    VALE_INSTALL_PREFIX,
    VALE_PACKAGE_FOLDERS,
    VALE_INSTALL_ARGUMENTS,
    VALE_STYLES_PATH_PATTERN,
} from '#cli/config/install/vale.ts';

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
 * @param install what install needs for this step.
 *
 * @returns the install summary.
 */
export async function installValePackages(install: ToolInstall): Promise<string> {
    const { session } = install;
    const { root } = session;
    const level = session.settingsFile.settings.level;
    if (level === 'recommended') return '';
    const tool = getTool(session.neededToolConfigurations, VALE_TOOL);
    const available = buildToolAvailability(
        tool,
        inspectTool({ ...session, miseBinPaths: getMiseBinPaths(session) }, tool),
    );
    if ('status' in available) throw new GspotError('tool', available.note);
    using files = openFiles(root);
    const temporary = mkdtempSync(join(files.readRealPath(DOT_GSPOT), VALE_INSTALL_PREFIX));
    try {
        const config = join(temporary, VALE_TOOL_FILE_PATH);
        const text = readText(root, VALE_TOOL_FILE_PATH);
        const last = [...text.matchAll(VALE_STYLES_PATH_PATTERN)].at(-1);
        const content = text.replaceAll(VALE_STYLES_PATH_PATTERN, (line, path: string, offset: number) =>
            offset === last?.index
                ? line
                : `StylesPath = ${convertToPosixPath(resolve(root, dirname(VALE_TOOL_FILE_PATH), path.trim()))}`,
        );
        mkdirSync(dirname(config), { recursive: true });
        writeFileSync(config, content);
        const command = [available.path, '--config', config, ...VALE_INSTALL_ARGUMENTS];
        const result = await runInstallStep(install, command, { cwd: dirname(config) });
        if (result.code !== 0)
            throw new GspotError(
                'install',
                `Vale sync failed (exit ${String(result.code)}):\n${redactInstallOutput(result, [])}`,
            );
        files.deleteTree(VALE_PACKAGES_PATH);
        renameSync(join(temporary, VALE_PACKAGES_PATH), join(root, VALE_PACKAGES_PATH));
        return `installed Vale packages in ${VALE_PACKAGES_PATH}`;
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
