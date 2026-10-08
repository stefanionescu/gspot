import { isDeepStrictEqual } from 'node:util';
import { openRoot } from '#cli/platform/root/public.ts';
import { openJsonDocument } from '#cli/parsers/public.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { openTomlDocument } from '#cli/parsers/toml/public.ts';
import type { EmittedToolFile } from '#cli/types/generation/files.ts';
import { decodeUtf8, normalizeTables } from '#cli/platform/contracts.ts';
import type { ConfigurationDocument } from '#cli/types/parsers/document.ts';

// Select the native parser and the empty content used only for an absent shared file.
function openConfigurationDocument(path: string, source: string | undefined): ConfigurationDocument {
    if (path.endsWith('.toml')) return openTomlDocument({ path, source: source ?? '' });
    if (path.endsWith('.json') || path.endsWith('.jsonc')) return openJsonDocument(path, source ?? '{}\n');
    throw new Error(`${path} has no supported shared configuration format.`);
}

/**
 * Opens shared fields after validating file encoding and any persisted native-format contract.
 * @param path the destination used for format selection and errors.
 * @param current the existing file, or undefined when generation creates it.
 * @param recordedFormat the format of fields already managed in that file.
 * @returns the document used by merge, inspection, and restoration.
 */
export function openMergedDocument(
    path: string,
    current: FileCopy | undefined,
    recordedFormat?: ConfigurationDocument['format'],
): ConfigurationDocument {
    const text = current === undefined ? undefined : decodeUtf8(current.bytes);
    if (current !== undefined && text === undefined) throw new Error(`${path} is not UTF-8 text`);
    const document = openConfigurationDocument(path, text);
    if (recordedFormat !== undefined && recordedFormat !== document.format)
        throw new Error(`${path} has a recorded configuration format that differs from its native format.`);
    return document;
}

/**
 * Inspect shared fields through the same parser used by lifecycle plans.
 * @param root the repository root.
 * @param output the shared configuration gspot installs keys into.
 * @param output.path the file path.
 * @param output.changes the keys and the values they must hold.
 * @returns whether the file exists and holds every installed value.
 */
export function hasFields(root: string, output: EmittedToolFile): boolean {
    using files = openRoot(root);
    const current = files.read(output.path);
    if (current === undefined) return false;
    const document = openMergedDocument(output.path, current);
    return output.changes.every((field) => isDeepStrictEqual(document.value(field.path), normalizeTables(field.value)));
}
