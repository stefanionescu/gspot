import { GspotError } from '#cli/system/errors.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import type { ArchiveDownload } from '#cli/types/installers/downloads.ts';

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
            if (size > limit) throw new GspotError('install', `${url} exceeds the size limit for ${name}.`);
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
}

/**
Download a release archive within the install timeout and a size limit.

@param install what install needs for this step.
@param download the archive URL, what it holds for messages, and its byte limit.
@returns the archive bytes.
*/
export async function downloadArchive(install: ToolInstall, download: ArchiveDownload): Promise<Buffer> {
    try {
        const signals = [AbortSignal.timeout(install.session.timeoutSeconds * MILLISECONDS_PER_SECOND)];
        if (install.session.cancelSignal !== undefined) signals.push(install.session.cancelSignal);
        const response = await fetch(download.url, { signal: AbortSignal.any(signals) });
        if (!response.ok)
            throw new GspotError(
                'install',
                `Cannot download ${download.name} ${download.url} (HTTP ${String(response.status)}).`,
            );
        return await readBoundedArchive(response, download);
    } catch (error) {
        install.session.cancelSignal?.throwIfAborted();
        if (error instanceof GspotError) throw error;
        throw new GspotError(
            'install',
            `Cannot download ${download.name} ${download.url}. Check the network or proxy, then run again.`,
            { cause: error },
        );
    }
}
