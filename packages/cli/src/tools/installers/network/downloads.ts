import http from 'node:http';
import { createHash } from 'node:crypto';
import { GspotError } from '#cli/system/errors.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import type { ArchiveDownload, DownloadSession } from '#cli/types/tools.ts';
import { NETWORK_ADVICE, PROXY_VARIABLES, NODE_PROXY_ADVICE } from '#cli/config/tools/installers.ts';

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

export function prepareProxy(): string {
    if (PROXY_VARIABLES.every((name) => readEnvironmentVariable(name) === undefined)) return NETWORK_ADVICE;
    if (!('setGlobalProxyFromEnv' in http)) return NODE_PROXY_ADVICE;
    http.setGlobalProxyFromEnv();
    return NETWORK_ADVICE;
}

/**
Download an archive, then check its SHA-256 value. A value that differs from the one the download names throws the
refusal of the download.
*/
export async function downloadArchive(session: DownloadSession, download: ArchiveDownload): Promise<Buffer> {
    const advice = prepareProxy();
    let bytes: Buffer;
    try {
        const signals = [AbortSignal.timeout(session.settings.tool_timeout_seconds * MILLISECONDS_PER_SECOND)];
        if (session.cancelSignal !== undefined) signals.push(session.cancelSignal);
        const response = await fetch(download.url, { signal: AbortSignal.any(signals) });
        if (!response.ok)
            throw new GspotError(
                'install',
                `Cannot download ${download.name} ${download.url} (HTTP ${String(response.status)}).`,
            );
        bytes = await readBoundedArchive(response, download);
    } catch (error) {
        session.cancelSignal?.throwIfAborted();
        if (error instanceof GspotError) throw error;
        throw new GspotError('install', `Cannot download ${download.name} ${download.url}. ${advice}`, {
            cause: error,
        });
    }
    if (createHash('sha256').update(bytes).digest('hex') !== download.sha256)
        throw new GspotError('install', download.refusal);
    return bytes;
}
