import { createHash } from 'node:crypto';
import { VALE_TOOL } from '#cli/config/prose.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { join, posix, dirname, resolve } from 'node:path';
import { downloadArchive } from '#cli/install/downloads.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { runRequiredInstallStep } from '#cli/install/steps.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { buildValeIni } from '#cli/generation/configurations/general/prose.ts';
import { rmSync, mkdirSync, renameSync, mkdtempSync, writeFileSync } from 'node:fs';

import {
    VALE_ARCHIVE_LIMIT,
    VALE_INSTALL_PREFIX,
    VALE_PACKAGE_FOLDERS,
    VALE_INSTALL_ARGUMENTS,
} from '#cli/config/install/vale.ts';
import {
    VALE_PACKAGES,
    VALE_STYLES_PATH,
    VALE_PACKAGE_RELEASES,
    VALE_PACKAGE_REPOSITORY,
} from '#cli/config/generation/configurations/general/prose.ts';

async function downloadValePackages(install: ToolInstall, folder: string): Promise<string[]> {
    const packages: string[] = [];
    for (const name of VALE_PACKAGES) {
        const release = VALE_PACKAGE_RELEASES[name];
        const url = `${VALE_PACKAGE_REPOSITORY}${name}/releases/download/${release.version}/${name}.zip`;
        const bytes = await downloadArchive(install, { url, name: 'the Vale package', limit: VALE_ARCHIVE_LIMIT });
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (sha256 !== release.sha256)
            throw new GspotError(
                'install',
                `The Vale package ${name} failed SHA-256 verification. gspot kept the installed packages.`,
            );
        const path = join(folder, `${name}.zip`);
        writeFileSync(path, bytes);
        packages.push(convertToPosixPath(path));
    }
    return packages;
}

/**
Check that the Vale packages exist before prose checks run.

@param repositoryRoot the root with the generated Vale files and package folders.
@param level recommended or all, which decides the packages.
@returns whether the Vale settings and the package folders exist.
*/
export function hasValePackages(repositoryRoot: string, level: Settings['level']): boolean {
    using files = openFiles(repositoryRoot);
    if (files.read(GSPOT_PATHS.valeConfigFile) === undefined) return false;
    if (level === 'recommended') return true;
    return VALE_PACKAGE_FOLDERS.every(
        (name) => files.readStats(`${GSPOT_PATHS.valePackages}/${name}`)?.isDirectory() === true,
    );
}

/**
Download the Vale packages for the level, and replace the installed ones. Needs the network.

@param install what install needs for this step.
@param miseBinPaths the program folders that mise installed, where Vale may sit.
@returns the install summary.
*/
export async function installValePackages(install: ToolInstall, miseBinPaths: string[]): Promise<string> {
    const { session } = install;
    const { root } = session;
    const level = session.settingsFile.settings.level;
    if (level === 'recommended') return '';
    const tool = getTool(session.toolConfigurations, VALE_TOOL);
    const available = buildToolAvailability(tool, inspectTool({ ...session, miseBinPaths }, tool));
    if ('status' in available) throw new GspotError('tool', available.note);
    using files = openFiles(root);
    const temporary = mkdtempSync(join(files.readCanonicalPath(DOT_GSPOT), VALE_INSTALL_PREFIX));
    try {
        const config = join(temporary, GSPOT_PATHS.valeConfigFile);
        const content = buildValeIni({
            level,
            stylesPaths: [
                convertToPosixPath(resolve(root, VALE_STYLES_PATH)),
                posix.relative(posix.dirname(GSPOT_PATHS.valeConfigFile), GSPOT_PATHS.valePackages),
            ],
            packages: await downloadValePackages(install, temporary),
        });
        mkdirSync(dirname(config), { recursive: true });
        writeFileSync(config, content);
        const command = [available.path, '--config', config, ...VALE_INSTALL_ARGUMENTS];
        await runRequiredInstallStep(install, command, { cwd: dirname(config), name: 'Vale sync' });
        files.deleteTree(GSPOT_PATHS.valePackages);
        renameSync(join(temporary, GSPOT_PATHS.valePackages), join(root, GSPOT_PATHS.valePackages));
        return `installed Vale packages in ${GSPOT_PATHS.valePackages}`;
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
