import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { ReasonedValue } from '#cli/types/settings/values.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import type { SettingsFileContents } from '#cli/types/settings/edits.ts';
import { SETTINGS_FILE, NO_SETTINGS_MESSAGE, SETTINGS_ENCODING_MESSAGE } from '#cli/config/settings/file.ts';

/**
Identify a written setting that carries both its value and its reason.

@param value the written setting.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers narrow the type through it.
export function isReasonedValue(value: unknown): value is ReasonedValue<unknown> {
    return isTable(value) && Object.hasOwn(value, 'value') && Object.hasOwn(value, 'reason');
}

/**
Read gspot.toml without following a link out of the repository.

@param root the folder that contains gspot.toml.
*/
export function readSettingsFile(root: string): SettingsFileContents {
    using files = openFiles(root);
    const previous = files.read(SETTINGS_FILE);
    if (previous === undefined) throw new GspotError('settings', NO_SETTINGS_MESSAGE);
    const text = decodeUtf8(previous.bytes);
    if (text === undefined) throw new GspotError('settings', SETTINGS_ENCODING_MESSAGE);
    return { text, previous };
}

/**
Write gspot.toml only while the file on disk still matches the one that the edit read.

@param writer the file writer for settings.
@param text the new gspot.toml contents.
@param previous the captured file bytes and mode.
*/
export function writeSettings(writer: Files, text: string, previous: FileContents | undefined): void {
    const next = { bytes: Buffer.from(text), mode: previous?.mode ?? OWNER_WRITABLE_FILE };
    if (isDeepStrictEqual(next, previous)) return;
    writePlans(
        writer,
        planReplacements(writer, [{ path: SETTINGS_FILE, next, expected: previous }]).map((plan) => ({
            ...plan,
            before: previous,
        })),
    );
}

/**
Find the source line of a written setting or record.

@param text the gspot.toml text.
@param written the table that the text holds.
@param keys the setting key or record path.
@returns the written source line.
*/
export function findSettingLine(text: string, written: Settings['written'], keys: KeyPath): number {
    const syntax = parseTomlSyntax(text, written);
    const record = syntax.pathNodes
        .filter(
            (node) =>
                node.kind === 'header' &&
                typeof node.path.at(-1) === 'number' &&
                node.path.every((key, index) => key === keys[index]),
        )
        .toSorted((left, right) => right.path.length - left.path.length)[0];
    const found =
        record ??
        syntax.pathNodes.find(
            (node) => node.path.length === keys.length && node.path.every((key, index) => key === keys[index]),
        );
    return found?.node.loc.start.line ?? 1;
}
