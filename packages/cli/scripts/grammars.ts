import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import type { PinnedDownload } from '#automation/types/grammars.ts';
import { RUNTIME_WASM, GRAMMAR_PACKAGES } from '#cli/config/platform/assets.ts';
import { SWIFT_GRAMMAR, DOWNLOAD_TIMEOUT_MS } from '#automation/config/grammars.ts';
import { rmSync, mkdirSync, existsSync, renameSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Downloads a pinned file unless it exists, and verifies its SHA-256.
 * @param path the ignored build-cache file
 * @param input the pinned download URL and expected checksum
 * @param input.url where the input is downloaded from
 * @param input.checksum the checksum the download must have
 */
async function downloadPinnedFile(path: string, input: PinnedDownload): Promise<void> {
    const isCached = existsSync(path);
    let bytes: Uint8Array;
    if (isCached) bytes = readFileSync(path);
    else {
        const response = await fetch(input.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`Build input download failed: HTTP ${String(response.status)}.`);
        bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (createHash('sha256').update(bytes).digest('hex') !== input.checksum)
        throw new Error(
            isCached
                ? `Build input checksum mismatch: ${path}. Remove the cached file and run setup again.`
                : `The download does not match its pinned checksum: ${input.url}. Update SWIFT_GRAMMAR.`,
        );
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

if (import.meta.main) await copyGrammars(fileURLToPath(new URL('../grammars/', import.meta.url)));

/**
 * Copies every grammar the package ships into a folder, each with the license of its source, for the build.
 * @param folder the grammars folder of the package
 */
export async function copyGrammars(folder: string): Promise<void> {
    const requireFromCli = createRequire(fileURLToPath(new URL('../package.json', import.meta.url)));
    mkdirSync(join(folder, 'licenses'), { recursive: true });
    for (const [name, source] of Object.entries({ ...GRAMMAR_PACKAGES, ...RUNTIME_WASM })) {
        copyFileSync(requireFromCli.resolve(source), join(folder, name));
        const packageName = source.slice(0, source.indexOf('/'));
        copyFileSync(
            join(dirname(requireFromCli.resolve(`${packageName}/package.json`)), 'LICENSE'),
            join(folder, 'licenses', `${packageName}.txt`),
        );
    }
    await downloadPinnedFile(join(folder, SWIFT_GRAMMAR.name), SWIFT_GRAMMAR);
    await downloadPinnedFile(join(folder, 'licenses', 'tree-sitter-swift.txt'), SWIFT_GRAMMAR.license);
}
