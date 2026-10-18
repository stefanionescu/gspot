import { isDeepStrictEqual } from 'node:util';
import { parse } from '@decimalturn/toml-patch';
import { GspotError } from '#cli/system/errors.ts';
import { writePlans } from '#cli/ownership/writer.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Writer } from '#cli/types/ownership.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { PARSE_CONTEXT_LINES } from '#cli/config/settings/file.ts';
import type { SettingsFileContents } from '#cli/types/settings/edits.ts';

/**
 * Parse written settings or a template, and keep TOML date kinds and source locations.
 * @param text the written TOML.
 * @param path the source file or URL.
 * @param kind the document to name in the error.
 * @returns the parsed table, without defaults.
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
 * Read settings text through the repository file boundary.
 * @param repositoryRoot the folder that contains gspot.toml.
 * @returns the UTF-8 text and captured file identity.
 */
function readSettingsFile(repositoryRoot: string): SettingsFileContents {
    using files = openFiles(repositoryRoot);
    const original = files.read(SETTINGS_FILE);
    if (original === undefined)
        throw new GspotError('settings', 'There is no gspot.toml here. Run `gspot init` to create one.');
    const text = decodeUtf8(original.bytes);
    if (text === undefined) throw new GspotError('settings', 'gspot.toml must contain valid UTF-8 text.');
    return { text, original };
}

/**
 * Write gspot.toml only while the file on disk still matches the one that the edit read.
 * @param writer the file writer for settings.
 * @param text the new gspot.toml contents.
 * @param original the captured file bytes and mode.
 */
function writeSettings(writer: Writer, text: string, original: FileContents | undefined): void {
    const next = { bytes: Buffer.from(text), mode: original?.mode ?? OWNER_WRITABLE_FILE };
    if (isDeepStrictEqual(next, original)) return;
    writePlans(writer, [
        {
            ...planReplacement(writer, {
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
