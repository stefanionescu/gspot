import { decodeUtf8 } from '#cli/text.ts';
import { isDeepStrictEqual } from 'node:util';
import { normalizeTables } from '#cli/objects.ts';
import { openJsonFile } from '#cli/parsers/json.ts';
import { openTomlFile } from '#cli/parsers/toml/document.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import type { FileCopy } from '#cli/types/system/safe-folder.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import type { FileEdit, KeyChangePlan, KeyChangeRequest } from '#cli/types/ownership.ts';
import { TOML_EXTENSION, EMPTY_JSON_TEXT, JSON_EDIT_EXTENSIONS } from '#cli/config/ownership.ts';

/**
 * Merge the requested keys and leave every other value in place.
 * @param request the current copy and requested values.
 * @returns the merged copy and whether its text changed.
 */
function planKeyChanges(request: KeyChangeRequest): KeyChangePlan {
    const { path, changes, current } = request;
    const document = openKeysDocument(path, current);
    const before = current === undefined ? '' : document.text();
    for (const field of changes) document.set(field.path, field.value);
    const text = document.text();
    return {
        next: { bytes: Buffer.from(text), mode: current?.mode ?? OWNER_WRITABLE_FILE },
        status: text === before ? 'unchanged' : 'changed',
    };
}

/**
 * Opens managed keys after checking the file encoding and selecting its parser.
 *
 * @param path the destination used for format selection and errors.
 * @param current the existing file, or undefined when generation creates it.
 *
 * @returns the document used by merge, inspection, and restoration.
 */
function openKeysDocument(path: string, current: FileCopy | undefined): EditableFile {
    const text = current === undefined ? undefined : decodeUtf8(current.bytes);
    if (current !== undefined && text === undefined) throw new Error(`${path} is not UTF-8 text`);
    if (path.endsWith(TOML_EXTENSION)) return openTomlFile({ path, source: text ?? '' });
    if (JSON_EDIT_EXTENSIONS.some((extension) => path.endsWith(extension)))
        return openJsonFile(path, text ?? EMPTY_JSON_TEXT);
    throw new Error(`${path} has no supported shared configuration format.`);
}

/**
 * Inspect managed keys through the same parser used by ownership plans.
 *
 * @param root the repository root.
 * @param output the file gspot writes managed keys into.
 * @param output.path the file path.
 * @param output.changes the keys and the values they must hold.
 *
 * @returns whether the file exists and holds every installed value.
 */
function hasManagedKeys(root: string, output: FileEdit): boolean {
    using files = openSafeFolder(root);
    const current = files.read(output.path);
    if (current === undefined) return false;
    const document = openKeysDocument(output.path, current);
    return output.changes.every((field) => isDeepStrictEqual(document.value(field.path), normalizeTables(field.value)));
}

export { planKeyChanges, hasManagedKeys };
