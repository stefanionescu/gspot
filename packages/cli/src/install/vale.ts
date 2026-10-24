import { createHash } from 'node:crypto';
import { GspotError } from '#cli/system/errors.ts';
import { join, dirname, resolve } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import { readText } from '#cli/system/files/reads.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import { getMiseBinPaths } from '#cli/tools/locate.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { VALE_TOOL } from '#cli/config/checks/general/prose.ts';
import { redactInstallOutput } from '#cli/install/credentials.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { rmSync, mkdirSync, renameSync, mkdtempSync, writeFileSync } from 'node:fs';

import {
    VALE_PACKAGES,
    VALE_PACKAGE_RELEASES,
    VALE_PACKAGE_REPOSITORY,
} from '#cli/config/generation/configurations/general/prose.ts';
import {
    VALE_ARCHIVE_LIMIT,
    VALE_INSTALL_PREFIX,
    VALE_PACKAGE_FOLDERS,
    VALE_PACKAGES_PATTERN,
    VALE_INSTALL_ARGUMENTS,
    VALE_STYLES_PATH_PATTERN,
} from '#cli/config/install/vale.ts';

async function readBoundedArchive(response: Response, url: string): Promise<Buffer> {
    const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = response.body?.getReader();
    if (reader === undefined) return Buffer.alloc(0);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return Buffer.concat(chunks);
            size += value.length;
            if (size > VALE_ARCHIVE_LIMIT)
                throw new GspotError('install', `The Vale package ${url} exceeds the archive size limit.`);
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
}

async function readValeArchive(install: ToolInstall, url: string): Promise<Buffer> {
    try {
        const signals = [AbortSignal.timeout(install.session.timeoutSeconds * MILLISECONDS_PER_SECOND)];
        if (install.session.cancelSignal !== undefined) signals.push(install.session.cancelSignal);
        const response = await fetch(url, { signal: AbortSignal.any(signals) });
        if (!response.ok)
            throw new GspotError(
                'install',
                `Cannot download the Vale package ${url} (HTTP ${String(response.status)}).`,
            );
        return await readBoundedArchive(response, url);
    } catch (error) {
        install.session.cancelSignal?.throwIfAborted();
        if (error instanceof GspotError) throw error;
        throw new GspotError(
            'install',
            `Cannot download the Vale package ${url}. Check the network or proxy, then run again.`,
            { cause: error },
        );
    }
}

async function downloadValePackages(install: ToolInstall, folder: string): Promise<string[]> {
    const packages: string[] = [];
    for (const name of VALE_PACKAGES) {
        const release = VALE_PACKAGE_RELEASES[name];
        const url = `${VALE_PACKAGE_REPOSITORY}${name}/releases/download/${release.version}/${name}.zip`;
        const bytes = await readValeArchive(install, url);
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
@returns the install summary.
*/
export async function installValePackages(install: ToolInstall): Promise<string> {
    const { session } = install;
    const { root } = session;
    const level = session.settingsFile.settings.level;
    if (level === 'recommended') return '';
    const tool = getTool(session.toolConfigurations, VALE_TOOL);
    const available = buildToolAvailability(
        tool,
        inspectTool({ ...session, miseBinPaths: getMiseBinPaths(session) }, tool),
    );
    if ('status' in available) throw new GspotError('tool', available.note);
    using files = openFiles(root);
    const temporary = mkdtempSync(join(files.readCanonicalPath(DOT_GSPOT), VALE_INSTALL_PREFIX));
    try {
        const config = join(temporary, GSPOT_PATHS.valeConfigFile);
        const text = readText(root, GSPOT_PATHS.valeConfigFile);
        const last = [...text.matchAll(VALE_STYLES_PATH_PATTERN)].at(-1);
        const packages = await downloadValePackages(install, temporary);
        const content = text
            .replaceAll(VALE_PACKAGES_PATTERN, `Packages = ${packages.join(', ')}`)
            .replaceAll(VALE_STYLES_PATH_PATTERN, (line, path: string, offset: number) =>
                offset === last?.index
                    ? line
                    : `StylesPath = ${convertToPosixPath(resolve(root, dirname(GSPOT_PATHS.valeConfigFile), path.trim()))}`,
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
        files.deleteTree(GSPOT_PATHS.valePackages);
        renameSync(join(temporary, GSPOT_PATHS.valePackages), join(root, GSPOT_PATHS.valePackages));
        return `installed Vale packages in ${GSPOT_PATHS.valePackages}`;
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
