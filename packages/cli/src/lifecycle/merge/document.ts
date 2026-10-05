import { isDeepStrictEqual } from 'node:util';
import { openRoot } from '#cli/platform/root/open.ts';
import { openTomlDocument } from '#cli/parsers/toml/document.ts';
import type { ConfigurationOutput } from '#cli/types/generation/output.ts';

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
    const document = openTomlDocument({ path: output.path, source: current.bytes.toString('utf8') });
    return output.changes.every((field) => isDeepStrictEqual(document.value(field.path), field.value));
}
