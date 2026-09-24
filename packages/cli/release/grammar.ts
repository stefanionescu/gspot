import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Command, CommanderError } from 'commander';
import upstream from './notices.json' with { type: 'json' };
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const DOWNLOAD_TIMEOUT_MS = 30_000;

if (import.meta.main) {
    try {
        new Command('bun packages/cli/release/grammar.ts')
            .description('Download and verify the pinned upstream Swift parser into ignored build output')
            .allowExcessArguments(false)
            .exitOverride()
            .parse();
        await prepareGrammar(fileURLToPath(new URL('../build/swift.wasm', import.meta.url)));
    } catch (error) {
        if (!(error instanceof CommanderError)) throw error;
        process.exitCode = error.exitCode === 0 ? 0 : 2;
    }
}

/**
 * Prepare verified build input without downloading anything at CLI runtime.
 * @param path the ignored build-cache file
 */
export async function prepareGrammar(path: string): Promise<void> {
    const isCached = existsSync(path);
    let bytes: Uint8Array;
    if (isCached) bytes = readFileSync(path);
    else {
        const response = await fetch(upstream.swift.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`Swift grammar download failed: HTTP ${String(response.status)}.`);
        bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (new Bun.CryptoHasher('sha256').update(bytes).digest('hex') !== upstream.swift.sha256)
        throw new Error('Swift grammar checksum mismatch. Remove the cached file and run mise run prepare:grammar.');
    if (isCached) return;
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
        writeFileSync(temporary, bytes, { flag: 'wx' });
        renameSync(temporary, path);
    } finally {
        rmSync(temporary, { force: true });
    }
}
