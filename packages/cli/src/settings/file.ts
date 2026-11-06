import { isDeepStrictEqual } from 'node:util';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { NO_SETTINGS_MESSAGE, SETTINGS_ENCODING_MESSAGE } from '#cli/config/settings/validation.ts';
import { parseTomlFile, parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import { planReplacements, writePlans } from '#cli/repository/writer.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import type { KeyPath } from '#cli/types/parsers.ts';
import type { ReasonedValue, Settings, SettingsEdit } from '#cli/types/settings.ts';
import type { FileContents, Files } from '#cli/types/system.ts';

export function isReasonedValue(value: unknown): value is ReasonedValue<unknown> {
    return isTable(value) && Object.hasOwn(value, 'value') && Object.hasOwn(value, 'reason');
}

/**
Read the bytes, mode, and text of gspot.toml without following a link out of the repository.
*/
export function readSettingsText(root: string): Pick<SettingsEdit, 'text' | 'previous'> {
    const files = openFiles(root);
    const previous = files.read(SETTINGS_FILE);
    if (previous === undefined) throw new GspotError('settings', NO_SETTINGS_MESSAGE);
    const text = decodeUtf8(previous.bytes);
    if (text === undefined) throw new GspotError('settings', SETTINGS_ENCODING_MESSAGE);
    return { text, previous };
}

export function readSettingsFile(root: string): SettingsEdit {
    const { text, previous } = readSettingsText(root);
    const table = parseTomlFile(SETTINGS_FILE, text);
    return { text, table, previous };
}

export function writeSettings(writer: Files, text: string, previous: FileContents | undefined): void {
    const next = { bytes: Buffer.from(text), mode: previous?.mode ?? OWNER_WRITABLE_FILE };
    if (isDeepStrictEqual(next, previous)) return;
    writePlans(writer, planReplacements(writer, [{ path: SETTINGS_FILE, next, previous: previous }]));
}

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
