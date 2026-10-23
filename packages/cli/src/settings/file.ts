import { isDeepStrictEqual } from 'node:util';
import { parse } from '@decimalturn/toml-patch';
import { isTable } from '#cli/system/tables.ts';
import { writePlans } from '#cli/apply/writer.ts';
import type { Writer } from '#cli/types/apply.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { planReplacement } from '#cli/apply/write-plans.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import type { ReasonedValue } from '#cli/types/settings/tables.ts';
import type { SettingsFileContents } from '#cli/types/settings/edits.ts';
import { SETTINGS_FILE, PARSE_CONTEXT_LINES } from '#cli/config/settings/file.ts';

/**
 * Identify a written setting that carries both its value and its reason.
 *
 * @param value the written setting.
 * @returns whether the setting has both reasoned-value fields.
 */
export function isReasonedValue(value: unknown): value is ReasonedValue<unknown> {
    return isTable(value) && Object.hasOwn(value, 'value') && Object.hasOwn(value, 'reason');
}

/**
 * Parse written settings or a template, keep TOML date types, and name the file, line, and column of a syntax error.
 *
 * @param text the written TOML.
 * @param path the source file or URL.
 * @returns the parsed table, without defaults.
 */
export function parseTomlText(text: string, path: string): TomlTable {
    try {
        return parse(text) as TomlTable;
    } catch (error) {
        if (!(error instanceof Error) || !('line' in error) || !('column' in error)) throw error;
        const { line, column } = error;
        if (typeof line !== 'number' || typeof column !== 'number') throw error;
        const detail = error.message.split('\n').slice(PARSE_CONTEXT_LINES).join('\n');
        throw new GspotError('settings', `${path}:${String(line)}:${String(column + 1)} is not valid TOML: ${detail}`);
    }
}

/**
 * Read gspot.toml without following a link out of the repository.
 *
 * @param repositoryRoot the folder that contains gspot.toml.
 * @returns the text, and the bytes and mode as read, which writeSettings compares before it writes.
 */
export function readSettingsFile(repositoryRoot: string): SettingsFileContents {
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
 *
 * @param writer the file writer for settings.
 * @param text the new gspot.toml contents.
 * @param original the captured file bytes and mode.
 */
export function writeSettings(writer: Writer, text: string, original: FileContents | undefined): void {
    const next = { bytes: Buffer.from(text), mode: original?.mode ?? OWNER_WRITABLE_FILE };
    if (isDeepStrictEqual(next, original)) return;
    writePlans(writer, [
        {
            ...planReplacement(writer, {
                path: SETTINGS_FILE,
                next,
                expected: original,
            }),
            before: original,
        },
    ]);
}
