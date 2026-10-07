import { openJsonDocument } from '#cli/parsers/json.ts';
import { openTomlDocument } from '#cli/parsers/toml/document.ts';
import type { ConfigurationDocument } from '#cli/types/parsers/document.ts';

/**
 * Opens the native format of a shared configuration file, creating empty text only for an absent file.
 * @param path the authored destination.
 * @param source its text, or undefined when the file does not exist.
 * @returns the document used by merge planning, inspection, and restoration.
 */
export function openConfigurationDocument(path: string, source: string | undefined): ConfigurationDocument {
    if (path.endsWith('.toml')) return openTomlDocument({ path, source: source ?? '' });
    if (path.endsWith('.json') || path.endsWith('.jsonc')) return openJsonDocument(path, source ?? '{}\n');
    throw new Error(`${path} has no supported shared configuration format.`);
}
