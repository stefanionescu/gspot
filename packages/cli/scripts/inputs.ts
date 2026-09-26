import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Command, CommanderError } from 'commander';
import { SWIFT_GRAMMAR } from '#cli/constants/platform.ts';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const DOWNLOAD_TIMEOUT_MS = 30_000;

if (import.meta.main) {
    try {
        new Command('bun packages/cli/scripts/inputs.ts')
            .description('Download and verify the pinned upstream Swift parser into ignored build output')
            .allowExcessArguments(false)
            .exitOverride()
            .parse();
        await prepareInput(fileURLToPath(new URL('../.build/swift.wasm', import.meta.url)), SWIFT_GRAMMAR);
    } catch (error) {
        if (!(error instanceof CommanderError)) throw error;
        process.exitCode = error.exitCode === 0 ? 0 : 2;
    }
}

/**
 * Prepare verified build input without downloading anything at CLI runtime.
 * @param path the ignored build-cache file
 * @param input the pinned download URL and expected checksum
 * @param input.url where the input is downloaded from
 * @param input.sha256 the checksum the download must have
 * @returns the verified bytes
 */
export async function prepareInput(path: string, input: { url: string; sha256: string }): Promise<Uint8Array> {
    const isCached = existsSync(path);
    let bytes: Uint8Array;
    if (isCached) bytes = readFileSync(path);
    else {
        const response = await fetch(input.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`Build input download failed: HTTP ${String(response.status)}.`);
        bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (new Bun.CryptoHasher('sha256').update(bytes).digest('hex') !== input.sha256)
        throw new Error(`Build input checksum mismatch: ${path}. Remove the cached file and prepare it again.`);
    if (isCached) return bytes;
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
        writeFileSync(temporary, bytes, { flag: 'wx' });
        renameSync(temporary, path);
    } finally {
        rmSync(temporary, { force: true });
    }
    return bytes;
}
