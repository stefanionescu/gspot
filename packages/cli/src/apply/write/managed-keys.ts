import { isDeepStrictEqual } from 'node:util';
import { normalizeTables } from '#cli/system/tables.ts';
import { openJsonFile } from '#cli/parsers/formats/json.ts';
import { decodeUtf8Text } from '#cli/system/files/reads.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { openTomlFile } from '#cli/parsers/formats/toml/document.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import type { Writer, WritePlan, ManagedKeys } from '#cli/types/apply.ts';
import { TOML_EXTENSION, EMPTY_JSON_TEXT, JSON_SETTINGS_EXTENSIONS } from '#cli/config/apply/write/managed-keys.ts';

/**
 * Open a shared settings file after checking its encoding.
 *
 * @param path the file, which also picks the format.
 * @param current the existing file, or undefined when generation creates it.
 * @returns the editable document.
 */
function openSettingsDocument(path: string, current: FileContents | undefined): EditableFile {
    const text = current === undefined ? undefined : decodeUtf8Text(path, current.bytes);
    const source = text ?? '';
    if (path.endsWith(TOML_EXTENSION)) return openTomlFile(path, source);
    if (JSON_SETTINGS_EXTENSIONS.some((extension) => path.endsWith(extension)))
        return openJsonFile(path, text ?? EMPTY_JSON_TEXT);
    throw new Error(`${path} has no format that gspot can set keys in.`);
}

/**
 * Plan the managed keys of a shared file: merge the requested keys, and leave every other value in place.
 *
 * @param writer the locked repository handle.
 * @param path the destination.
 * @param keys the keys and requested values.
 * @returns the key write plan.
 */
export function planSettingsWrite(writer: Writer, path: string, keys: ManagedKeys['keys']): WritePlan {
    const current = writer.files.read(path);
    const document = openSettingsDocument(path, current);
    const before = current === undefined ? '' : document.getText();
    for (const field of keys) document.set(field.key, field.value);
    const text = document.getText();
    return {
        path,
        before: current,
        after: { bytes: Buffer.from(text), mode: current?.mode ?? OWNER_WRITABLE_FILE },
        status: text === before ? 'unchanged' : 'changed',
    };
}

/**
 * Check whether a file holds every managed key with its value. It reads the file with the parser that the write plans
 * use.
 *
 * @param output the file gspot writes managed keys into.
 * @param output.path where the file sits.
 * @param output.keys the keys and the values they must hold.
 * @param current the file contents on disk.
 * @returns whether every key holds its value.
 */
export function hasManagedKeys(output: ManagedKeys, current: FileContents): boolean {
    const document = openSettingsDocument(output.path, current);
    return output.keys.every((field) => isDeepStrictEqual(document.getValue(field.key), normalizeTables(field.value)));
}
