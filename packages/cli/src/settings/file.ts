import { isDeepStrictEqual } from 'node:util';
import { parse } from '@decimalturn/toml-patch';
import { GspotError } from '#cli/system/errors.ts';
import { writePlans } from '#cli/ownership/writer.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Writer } from '#cli/types/ownership.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import type { FileCopy } from '#cli/types/system/files.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { PARSE_CONTEXT_LINES } from '#cli/config/settings/file.ts';
import type { TomlTable, SettingsSource } from '#cli/types/settings/file.ts';

/**
 * Read written settings or template values while retaining TOML date kinds and source locations.
 * @param text the written TOML
 * @param path the source file or URL
 * @param kind the document to name in the error
 * @returns the parsed table without execution defaults
 */
function parseTomlText(text: string, path: string, kind: 'settings' | 'template'): TomlTable {
    try {
        return parse(text) as TomlTable;
    } catch (error) {
        if (!(error instanceof Error) || !('line' in error) || !('column' in error)) throw error;
        const { line, column } = error;
        if (typeof line !== 'number' || typeof column !== 'number') throw error;
        const detail = error.message.split('\n').slice(PARSE_CONTEXT_LINES).join('\n');
        throw new GspotError(kind, `${path}:${String(line)}:${String(column + 1)} is not valid TOML: ${detail}`);
    }
}

/**
 * Read written settings text, following only links contained by the repository.
 * @param root the repository root
 * @returns the UTF-8 settings text
 */
function readSettingsFile(root: string): SettingsSource {
    using files = openFiles(root);
    const original = files.read(SETTINGS_FILE);
    if (original === undefined)
        throw new GspotError('settings', 'There is no gspot.toml here. Run `gspot init` to create one.');
    return { text: decodeSettingsText(original.bytes), original };
}

/**
 * Decode settings bytes captured at the file boundary.
 * @param bytes the captured settings bytes
 * @returns the UTF-8 settings text
 */
function decodeSettingsText(bytes: Buffer): string {
    const text = decodeUtf8(bytes);
    if (text === undefined) throw new GspotError('settings', 'gspot.toml must contain valid UTF-8 text.');
    return text;
}

/**
 * Write settings bytes only while the captured file identity matches.
 * @param log the locked ownership log
 * @param text the settings text to write
 * @param original the captured file bytes and mode
 */
function writeSettings(log: Writer, text: string, original: FileCopy | undefined): void {
    const next = { bytes: Buffer.from(text), mode: original?.mode ?? OWNER_WRITABLE_FILE };
    if (isDeepStrictEqual(next, original)) return;
    writePlans(log, [
        {
            ...planReplacement(log, {
                path: SETTINGS_FILE,
                next,
                canReplace: true,
                expected: original,
            }),
            before: original,
        },
    ]);
}

export { parseTomlText, writeSettings, readSettingsFile };
