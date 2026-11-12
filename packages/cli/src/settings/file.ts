import { isDeepStrictEqual } from 'node:util';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { NO_SETTINGS_MESSAGE, SETTINGS_ENCODING_MESSAGE } from '#cli/config/settings/validation.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { planReplacements, writePlans } from '#cli/repository/writer.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import type { SettingsFile } from '#cli/types/settings.ts';
import type { FileContents, Files } from '#cli/types/system.ts';

/**
Read the bytes, mode, and text of gspot.toml without following a link out of the repository.
*/
export function readSettingsText(root: string): Pick<SettingsFile, 'text' | 'previous'> {
    const files = openFiles(root);
    const previous = files.read(SETTINGS_FILE);
    if (previous === undefined) throw new GspotError('settings', NO_SETTINGS_MESSAGE);
    const text = decodeUtf8(previous.bytes);
    if (text === undefined) throw new GspotError('settings', SETTINGS_ENCODING_MESSAGE);
    return { text, previous };
}

export function readSettingsFile(root: string): SettingsFile {
    const { text, previous } = readSettingsText(root);
    const table = parseTomlFile(SETTINGS_FILE, text);
    return { text, table, previous };
}

export function writeSettings(writer: Files, text: string, previous: FileContents | undefined): void {
    const next = { bytes: Buffer.from(text), mode: previous?.mode ?? OWNER_WRITABLE_FILE };
    if (isDeepStrictEqual(next, previous)) return;
    writePlans(writer, planReplacements(writer, [{ path: SETTINGS_FILE, next, previous: previous }]));
}
