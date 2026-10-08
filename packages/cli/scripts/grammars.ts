import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { CLI_PINS } from '#cli/config/pins.ts';
import { createHash, randomUUID } from 'node:crypto';
import type { PinnedDownload } from '#cli/types/platform/assets.ts';
import { rm, mkdir, rename, copyFile, readFile, writeFile } from 'node:fs/promises';
import { RUNTIME_WASM, GRAMMAR_PACKAGES, DOWNLOAD_TIMEOUT_MS } from '#cli/config/platform/assets.ts';

/**
 * Downloads a pinned file unless it exists, and verifies its SHA-256.
 * @param path the ignored build-cache file
 * @param input the pinned download URL and expected checksum
 * @param input.url where the input is downloaded from
 * @param input.checksum the checksum the download must have
 */
async function downloadPinnedFile(path: string, input: PinnedDownload): Promise<void> {
    const cached = await readFile(path).catch((error: unknown) => {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        return undefined;
    });
    const isCached = cached !== undefined;
    let bytes: Uint8Array;
    if (cached === undefined) {
        const response = await fetch(input.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`Build input download failed: HTTP ${String(response.status)}.`);
        bytes = new Uint8Array(await response.arrayBuffer());
    } else {
        bytes = cached;
    }
    if (createHash('sha256').update(bytes).digest('hex') !== input.checksum)
        throw new Error(
            isCached
                ? `Build input checksum mismatch: ${path}. Remove the cached file and run setup again.`
                : `The download does not match its pinned checksum: ${input.url}. Update CLI_PINS.swiftGrammar.`,
        );
    if (isCached) return;
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporary, bytes, { flag: 'wx' });
        await rename(temporary, path);
    } finally {
        await rm(temporary, { force: true });
    }
}

await copyGrammars(fileURLToPath(new URL('../grammars/', import.meta.url)));

/**
 * Copies every grammar the package ships into a folder, each with the license of its source, for the build.
 * @param folder the grammars folder of the package
 */
async function copyGrammars(folder: string): Promise<void> {
    const requireFromCli = createRequire(fileURLToPath(new URL('../package.json', import.meta.url)));
    await mkdir(join(folder, 'licenses'), { recursive: true });
    for (const [name, source] of Object.entries({ ...GRAMMAR_PACKAGES, ...RUNTIME_WASM })) {
        await copyFile(requireFromCli.resolve(source), join(folder, name));
        const packageName = source.slice(0, source.indexOf('/'));
        await copyFile(
            join(dirname(requireFromCli.resolve(`${packageName}/package.json`)), 'LICENSE'),
            join(folder, 'licenses', `${packageName}.txt`),
        );
    }
    await downloadPinnedFile(join(folder, CLI_PINS.swiftGrammar.name), CLI_PINS.swiftGrammar);
    await downloadPinnedFile(join(folder, 'licenses', 'tree-sitter-swift.txt'), CLI_PINS.swiftGrammar.license);
}
