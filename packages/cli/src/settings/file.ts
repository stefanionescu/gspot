import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { KeyPath } from '#cli/types/parsers.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { Files, FileContents } from '#cli/types/system.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import { parseTomlFile, parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import type { Settings, SettingsEdit, ReasonedValue } from '#cli/types/settings.ts';
import { NO_SETTINGS_MESSAGE, SETTINGS_ENCODING_MESSAGE } from '#cli/config/settings/validation.ts';

/**
Identify a written setting that carries both its value and its reason.

@param value the written setting.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers narrow the type through it.
export function isReasonedValue(value: unknown): value is ReasonedValue<unknown> {
    return isTable(value) && Object.hasOwn(value, 'value') && Object.hasOwn(value, 'reason');
}

/**
Read the bytes, mode, and table of gspot.toml without following a link out of the repository.

@param root the folder that contains gspot.toml.
*/
export function readSettingsFile(root: string): SettingsEdit {
    const files = openFiles(root);
    const previous = files.read(SETTINGS_FILE);
    if (previous === undefined) throw new GspotError('settings', NO_SETTINGS_MESSAGE);
    const text = decodeUtf8(previous.bytes);
    if (text === undefined) throw new GspotError('settings', SETTINGS_ENCODING_MESSAGE);
    return { text, table: parseTomlFile(SETTINGS_FILE, text), previous };
}

/**
Write gspot.toml when its bytes or mode change.

@param writer the file writer for settings.
@param text the new gspot.toml contents.
@param previous the captured file bytes and mode.
*/
export function writeSettings(writer: Files, text: string, previous: FileContents | undefined): void {
    const next = { bytes: Buffer.from(text), mode: previous?.mode ?? OWNER_WRITABLE_FILE };
    if (isDeepStrictEqual(next, previous)) return;
    writePlans(writer, planReplacements(writer, [{ path: SETTINGS_FILE, next, previous: previous }]));
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
