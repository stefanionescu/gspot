import { basename } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { openJsonFile } from '#cli/parsers/json.ts';
import { openYamlFile } from '#cli/parsers/yaml.ts';
import { NPMRC_FILE } from '#cli/config/tools/npm.ts';
import { openNpmrcFile } from '#cli/parsers/npmrc.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { normalizeTables } from '#cli/system/values.ts';
import { openTomlFile } from '#cli/parsers/toml/document.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import type { FileEdit, KeyChangePlan, KeyChangeRequest } from '#cli/types/ownership.ts';
import { TOML_EXTENSION, EMPTY_JSON_TEXT, YAML_EDIT_EXTENSIONS, JSON_EDIT_EXTENSIONS } from '#cli/config/ownership.ts';

/**
 * Merge the requested keys and leave every other value in place.
 * @param request the current file and the values to set.
 * @returns the merged file contents, and whether the text changed.
 */
function planKeyChanges(request: KeyChangeRequest): KeyChangePlan {
    const { path, changes, current } = request;
    const document = openKeysDocument(path, current);
    const before = current === undefined ? '' : document.getText();
    for (const field of changes) document.set(field.path, field.value);
    const text = document.getText();
    return {
        next: { bytes: Buffer.from(text), mode: current?.mode ?? OWNER_WRITABLE_FILE },
        status: text === before ? 'unchanged' : 'changed',
    };
}

/**
 * Open a file for managed keys after a check of its encoding.
 *
 * @param path the file, which also picks the format.
 * @param current the existing file, or undefined when generation creates it.
 *
 * @returns the editable document.
 */
function openKeysDocument(path: string, current: FileContents | undefined): EditableFile {
    const text = current === undefined ? undefined : decodeUtf8(current.bytes);
    if (current !== undefined && text === undefined) throw new Error(`${path} is not UTF-8 text`);
    return openEditableFile(path, text);
}

/**
 * Open a file in the editor that matches its name.
 * @param path the file, which also picks the format.
 * @param text the contents, or undefined when generation creates the file.
 * @returns an editor that sets keys and keeps other text.
 */
function openEditableFile(path: string, text: string | undefined): EditableFile {
    const source = text ?? '';
    if (path.endsWith(TOML_EXTENSION)) return openTomlFile({ path, source });
    if (JSON_EDIT_EXTENSIONS.some((extension) => path.endsWith(extension)))
        return openJsonFile(path, text ?? EMPTY_JSON_TEXT);
    if (YAML_EDIT_EXTENSIONS.some((extension) => path.endsWith(extension))) return openYamlFile(path, source);
    if (basename(path) === NPMRC_FILE) return openNpmrcFile(path, source);
    throw new Error(`${path} has no format that gspot can set keys in.`);
}

/**
 * Check the managed keys with the parser that ownership plans use.
 *
 * @param output the file gspot writes managed keys into.
 * @param output.path where the file sits.
 * @param output.changes the keys and the values they must hold.
 * @param current the file contents on disk.
 * @returns whether the file holds every installed value.
 */
function hasManagedKeys(output: FileEdit, current: FileContents): boolean {
    const document = openKeysDocument(output.path, current);
    return output.changes.every((field) =>
        isDeepStrictEqual(document.getValue(field.path), normalizeTables(field.value)),
    );
}

export { planKeyChanges, hasManagedKeys, openKeysDocument };
