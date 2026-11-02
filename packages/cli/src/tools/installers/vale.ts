import http from 'node:http';
import { createHash } from 'node:crypto';
import { getTool } from '#cli/tools/pins.ts';
import { join, posix, dirname } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { VALE_TEMPORARY_NAME } from '#cli/config/repository/setup.ts';
import { runRequiredInstallStep } from '#cli/tools/installers/steps.ts';
import { deleteStaleTemporaryPaths } from '#cli/system/files/folders.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { rmSync, mkdirSync, renameSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { ToolInstall, ArchiveDownload, DownloadSession } from '#cli/types/tools.ts';

import {
    JSON_INDENT,
    CONFIG_FLAG,
    NETWORK_ADVICE,
    PROXY_VARIABLES,
    NODE_PROXY_ADVICE,
} from '#cli/config/tools/installers.ts';
import {
    VALE_TOOL,
    VALE_PACKAGES,
    VALE_PACKAGE_URLS,
    VALE_INSTALL_STEP,
    VALE_DOWNLOAD_NAME,
    VALE_ARCHIVE_LIMIT,
    VALE_INSTALL_PREFIX,
    VALE_PACKAGE_FOLDERS,
    VALE_PACKAGE_RELEASES,
    VALE_INSTALL_ARGUMENTS,
} from '#cli/config/tools/vale.ts';

function selectProxyAdvice(): string {
    if (PROXY_VARIABLES.every((name) => readEnvironmentVariable(name) === undefined)) return NETWORK_ADVICE;
    if (!('setGlobalProxyFromEnv' in http)) return NODE_PROXY_ADVICE;
    http.setGlobalProxyFromEnv();
    return NETWORK_ADVICE;
}

async function downloadValePackages(install: ToolInstall, folder: string): Promise<string[]> {
    const packages: string[] = [];
    for (const name of VALE_PACKAGES) {
        const release = VALE_PACKAGE_RELEASES[name];
        const url = VALE_PACKAGE_URLS[name];
        const bytes = await downloadArchive(install.session, {
            url,
            name: VALE_DOWNLOAD_NAME,
            limit: VALE_ARCHIVE_LIMIT,
        });
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

async function readBoundedArchive(response: Response, { url, name, limit }: ArchiveDownload): Promise<Buffer> {
    const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = response.body?.getReader();
    if (reader === undefined) throw new GspotError('install', `${url} sent no content for ${name}.`);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return Buffer.concat(chunks);
            size += value.length;
            if (size > limit) {
                await reader.cancel();
                throw new GspotError('install', `${url} exceeds the size limit for ${name}.`);
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
}

/**
Check that the Vale packages exist before prose checks run.

@param root the root with the generated Vale files and package folders.
*/
export function hasValePackages(root: string): boolean {
    const files = openFiles(root);
    if (files.read(GSPOT_PATHS.valeConfig) === undefined) return false;
    return VALE_PACKAGE_FOLDERS.every(
        (name) => files.findStats(`${GSPOT_PATHS.valePackages}/${name}`)?.isDirectory() === true,
    );
}

/**
Download the Vale packages, and replace the installed ones, when a selected configuration uses Vale.
Skip the download when every package folder exists and the release file names the pinned releases. Needs the network.

@param install what install needs for this step.
@param miseBinPaths the program folders that mise installed, where Vale may sit.
*/
export async function installValePackages(install: ToolInstall, miseBinPaths: string[]): Promise<string> {
    const { session } = install;
    const { root } = session;
    const files = openFiles(root);
    deleteStaleTemporaryPaths(files, GSPOT_FOLDER, VALE_TEMPORARY_NAME);
    const hasVale = session.toolConfigurations.some(({ tools }) => tools.some((tool) => tool.name === VALE_TOOL));
    if (!hasVale || session.settings.level === 'basic') return '';
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

/**
Download a release archive within the install timeout and a size limit.

@param session the time limit and the cancel signal of the download.
@param download the archive to fetch.
*/
export async function downloadArchive(session: DownloadSession, download: ArchiveDownload): Promise<Buffer> {
    const advice = selectProxyAdvice();
    try {
        const signals = [AbortSignal.timeout(session.settings.tool_timeout_seconds * MILLISECONDS_PER_SECOND)];
        if (session.cancelSignal !== undefined) signals.push(session.cancelSignal);
        const response = await fetch(download.url, { signal: AbortSignal.any(signals) });
        if (!response.ok)
            throw new GspotError(
                'install',
                `Cannot download ${download.name} ${download.url} (HTTP ${String(response.status)}).`,
            );
        return await readBoundedArchive(response, download);
    } catch (error) {
        session.cancelSignal?.throwIfAborted();
        if (error instanceof GspotError) throw error;
        throw new GspotError('install', `Cannot download ${download.name} ${download.url}. ${advice}`, {
            cause: error,
        });
    }
}
