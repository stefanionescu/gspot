import { isDeepStrictEqual } from 'node:util';
import { normalizeTables } from '#cli/system/tables.ts';
import { openJsonFile } from '#cli/parsers/formats/json.ts';
import { decodeUtf8Text } from '#cli/system/files/reads.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import type { WritePlan, ManagedKeys } from '#cli/types/apply.ts';
import { openTomlFile } from '#cli/parsers/formats/toml/document.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import { TOML_EXTENSION, EMPTY_JSON_TEXT } from '#cli/config/apply/write/managed-keys.ts';

function openSettingsDocument(path: string, onDisk: FileContents | undefined, keys: ManagedKeys['keys']): EditableFile {
    const text = onDisk === undefined ? undefined : decodeUtf8Text(path, onDisk.bytes);
    if (path.endsWith(TOML_EXTENSION)) {
        const headers = new Set(
            keys
                .filter(({ key, value }) => value !== undefined && key.length > 1)
                .map(({ key }) =>
                    key
                        .slice(0, -1)
                        .map((name) => JSON.stringify(name))
                        .join('.'),
                ),
        );
        const contents = text ?? [...headers].map((header) => `[${header}]\n`).join('\n');
        return openTomlFile(path, contents);
    }
    return openJsonFile(path, text ?? EMPTY_JSON_TEXT);
}

/**
Plan the managed keys of a shared file: merge the requested keys, and leave every other value in place.

@param writer the locked repository handle.
@param path the destination.
@param keys the keys and requested values.
@returns the key write plan.
*/
export function planSettingsWrite(writer: Files, path: string, keys: ManagedKeys['keys']): WritePlan {
    const onDisk = writer.read(path);
    const document = openSettingsDocument(path, onDisk, keys);
    const before = onDisk === undefined ? '' : document.getText();
    for (const field of keys) document.set(field.key, field.value);
    const updated = document.getText();
    const text = path.endsWith(TOML_EXTENSION) && !updated.endsWith('\n') ? `${updated}\n` : updated;
    return {
        path,
        before: onDisk,
        after: { bytes: Buffer.from(text), mode: onDisk?.mode ?? OWNER_WRITABLE_FILE },
        status: text === before ? 'unchanged' : 'changed',
    };
}

/**
Check whether a file holds every managed key with its value. It reads the file with the parser that the write plans
use.

@param output the file gspot writes managed keys into.
@param output.path where the file sits.
@param output.keys the keys and the values they must hold.
@param onDisk the file contents on disk.
@returns whether every key holds its value.
*/
export function hasManagedKeys(output: ManagedKeys, onDisk: FileContents): boolean {
    const document = openSettingsDocument(output.path, onDisk, output.keys);
    return output.keys.every((field) => isDeepStrictEqual(document.getValue(field.key), normalizeTables(field.value)));
}
