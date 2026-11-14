import { join, posix, dirname } from 'node:path';
import { getTool } from '#cli/manifests/tools.ts';
import { GspotError } from '#cli/system/errors.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { ToolInstall } from '#cli/types/tools.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runRequiredInstallStep } from '#cli/tools/installers/steps.ts';
import { CONFIG_FLAG, JSON_INDENT } from '#cli/config/tools/programs.ts';
import { deleteStaleTemporaryPaths } from '#cli/system/files/temporary.ts';
import { downloadArchive } from '#cli/tools/installers/network/downloads.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/programs/inspect.ts';
import { rmSync, mkdirSync, renameSync, mkdtempSync, writeFileSync } from 'node:fs';

import {
    VALE_TOOL,
    VALE_PACKAGES,
    VALE_INSTALL_STEP,
    VALE_PACKAGE_URLS,
    VALE_ARCHIVE_LIMIT,
    VALE_DOWNLOAD_NAME,
    VALE_INSTALL_PREFIX,
    VALE_TEMPORARY_NAME,
    VALE_PACKAGE_FOLDERS,
    VALE_PACKAGE_RELEASES,
    VALE_INSTALL_ARGUMENTS,
} from '#cli/config/tools/vale.ts';

async function downloadValePackages(install: ToolInstall, folder: string): Promise<string[]> {
    const packages: string[] = [];
    for (const name of VALE_PACKAGES) {
        const release = VALE_PACKAGE_RELEASES[name];
        const url = VALE_PACKAGE_URLS[name];
        const bytes = await downloadArchive(install.session, {
            url,
            name: VALE_DOWNLOAD_NAME,
            limit: VALE_ARCHIVE_LIMIT,
            sha256: release.sha256,
            refusal: `The Vale package ${name} failed SHA-256 verification. gspot kept the installed packages. Run gspot install again, and check that no proxy rewrites the download.`,
        });
        const path = join(folder, `${name}.zip`);
        writeFileSync(path, bytes);
        packages.push(convertToPosixPath(path));
    }
    return packages;
}

export function hasValePackages(root: string): boolean {
    const files = openFiles(root);
    if (files.read(GSPOT_PATHS.valeConfig) === undefined) return false;
    return VALE_PACKAGE_FOLDERS.every(
        (name) => files.findStats(`${GSPOT_PATHS.valePackages}/${name}`)?.isDirectory() === true,
    );
}

/**
Download the Vale packages, and replace the installed ones, when gspot install installs Vale.
Skip the download when every package folder exists and the release file names the pinned releases. Needs the network.
*/
export async function installValePackages(install: ToolInstall, miseBinPaths: string[]): Promise<string> {
    const { session, checkTools } = install;
    const { root } = session;
    const files = openFiles(root);
    deleteStaleTemporaryPaths(files, GSPOT_FOLDER, VALE_TEMPORARY_NAME);
    if (!checkTools.has(VALE_TOOL) || session.settings.level === 'basic') return '';
    const releases = `${JSON.stringify(VALE_PACKAGE_RELEASES, null, JSON_INDENT)}\n`;
    if (files.read(GSPOT_PATHS.valeReleases)?.bytes.toString('utf8') === releases && hasValePackages(root)) return '';
    const tool = getTool(session.toolConfigurations, VALE_TOOL);
    const available = buildToolAvailability(tool, await inspectTool({ ...session, miseBinPaths }, tool));
    if ('status' in available) throw new GspotError('install', available.note);
    const temporary = mkdtempSync(
        join(files.readCanonicalPath(GSPOT_FOLDER), `${VALE_INSTALL_PREFIX}${String(process.pid)}-`),
    );
    try {
        const config = join(temporary, GSPOT_PATHS.valeConfig);
        const stylesPath = posix.relative(posix.dirname(GSPOT_PATHS.valeConfig), GSPOT_PATHS.valePackages);
        const packages = await downloadValePackages(install, temporary);
        mkdirSync(dirname(config), { recursive: true });
        writeFileSync(config, `StylesPath = ${stylesPath}\nPackages = ${packages.join(', ')}\n`);
        const command = [available.path, CONFIG_FLAG, config, ...VALE_INSTALL_ARGUMENTS];
        await runRequiredInstallStep(install, command, {
            cwd: dirname(config),
            step: `installing Vale packages into ${GSPOT_PATHS.valePackages}`,
            name: VALE_INSTALL_STEP,
        });
        writeFileSync(join(temporary, GSPOT_PATHS.valeReleases), releases);
        files.deleteTree(GSPOT_PATHS.valePackages);
        renameSync(join(temporary, GSPOT_PATHS.valePackages), join(root, GSPOT_PATHS.valePackages));
        return `installed Vale packages in ${GSPOT_PATHS.valePackages}`;
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
