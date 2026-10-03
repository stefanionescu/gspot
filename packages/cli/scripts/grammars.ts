import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { Command, CommanderError } from 'commander';
import { createHash, randomUUID } from 'node:crypto';
import { SWIFT_GRAMMAR } from '#cli/config/parsers/parsers.ts';
import { GRAMMAR_PACKAGES } from '#cli/config/platform/platform.ts';
import { rmSync, mkdirSync, existsSync, renameSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';

// The exit of a build step that did not finish.
const ERROR_EXIT = 2;

const DOWNLOAD_TIMEOUT_MS = 30_000;

if (import.meta.main) {
    try {
        new Command('bun packages/cli/scripts/grammars.ts')
            .description(
                'Download and verify the pinned Swift parser into grammars/. A source checkout reads the other grammars from node_modules, and the build copies them.',
            )
            .allowExcessArguments(false)
            .exitOverride()
            .parse();
        await prepareSwift(fileURLToPath(new URL('../grammars/', import.meta.url)));
    } catch (error) {
        if (!(error instanceof CommanderError)) throw error;
        process.exitCode = error.exitCode === 0 ? 0 : ERROR_EXIT;
    }
}

// The Swift parser, which no npm package carries, with its license.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Setup and the build both download the Swift parser and its license through this.
async function prepareSwift(folder: string): Promise<void> {
    await prepareInput(join(folder, 'swift.wasm'), SWIFT_GRAMMAR);
    await prepareInput(join(folder, 'licenses', 'tree-sitter-swift.txt'), SWIFT_GRAMMAR.license);
}

/**
 * Prepare verified build input without downloading anything at CLI runtime.
 * @param path the ignored build-cache file
 * @param input the pinned download URL and expected checksum
 * @param input.url where the input is downloaded from
 * @param input.checksum the checksum the download must have
 * @returns the verified bytes
 */
export async function prepareInput(path: string, input: { url: string; checksum: string }): Promise<Uint8Array> {
    const isCached = existsSync(path);
    let bytes: Uint8Array;
    if (isCached) bytes = readFileSync(path);
    else {
        const response = await fetch(input.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`Build input download failed: HTTP ${String(response.status)}.`);
        bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (createHash('sha256').update(bytes).digest('hex') !== input.checksum)
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

/**
 * Copies every grammar the package ships into a folder, each with the license of its source, for the build.
 * @param folder the grammars folder of the package
 */
export async function copyGrammars(folder: string): Promise<void> {
    const packages = createRequire(fileURLToPath(new URL('../package.json', import.meta.url)));
    mkdirSync(join(folder, 'licenses'), { recursive: true });
    for (const [name, source] of Object.entries(GRAMMAR_PACKAGES)) {
        copyFileSync(packages.resolve(source), join(folder, name));
        const owner = source.slice(0, source.indexOf('/'));
        copyFileSync(
            join(dirname(packages.resolve(`${owner}/package.json`)), 'LICENSE'),
            join(folder, 'licenses', `${owner}.txt`),
        );
    }
    await prepareSwift(folder);
}
