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

function openSettingsDocument(path: string, onDisk: FileContents | undefined): EditableFile {
    const text = onDisk === undefined ? undefined : decodeUtf8Text(path, onDisk.bytes);
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
    const onDisk = writer.files.read(path);
    const document = openSettingsDocument(path, onDisk);
    const before = onDisk === undefined ? '' : document.getText();
    for (const field of keys) document.set(field.key, field.value);
    const text = document.getText();
    return {
        path,
        before: onDisk,
        after: { bytes: Buffer.from(text), mode: onDisk?.mode ?? OWNER_WRITABLE_FILE },
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
 * @param onDisk the file contents on disk.
 * @returns whether every key holds its value.
 */
export function hasManagedKeys(output: ManagedKeys, onDisk: FileContents): boolean {
    const document = openSettingsDocument(output.path, onDisk);
    return output.keys.every((field) => isDeepStrictEqual(document.getValue(field.key), normalizeTables(field.value)));
}
