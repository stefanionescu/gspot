import { isDeepStrictEqual } from 'node:util';
import { decodeUtf8 } from '#cli/platform/text.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { normalizeTables } from '#cli/platform/objects.ts';
import type { Snapshot } from '#cli/types/platform/root.ts';
import { openConfigurationDocument } from '#cli/parsers/document.ts';
import type { ConfigurationOutput } from '#cli/types/generation/output.ts';
import type { ConfigurationDocument } from '#cli/types/platform/document.ts';

/**
 * Opens shared fields after validating file encoding and any persisted native-format contract.
 * @param path the destination used for format selection and errors.
 * @param current the existing file, or undefined when generation creates it.
 * @param recordedFormat the format of fields already managed in that file.
 * @returns the document used by merge, inspection, and restoration.
 */
export function openMergedDocument(
    path: string,
    current: Snapshot | undefined,
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
export function hasFields(root: string, output: ConfigurationOutput): boolean {
    using files = openRoot(root);
    const current = files.read(output.path);
    if (current === undefined) return false;
    const document = openMergedDocument(output.path, current);
    return output.changes.every((field) => isDeepStrictEqual(document.value(field.path), normalizeTables(field.value)));
}
