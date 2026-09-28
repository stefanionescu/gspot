import JSON5 from 'json5';
import { parse as parseYaml } from 'yaml';
import { posix, extname } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { FileObservation } from '#cli/types/platform.ts';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import type { ConfigurationSource } from '#cli/types/policy/adoption.ts';
import { sqlfluffConfiguration } from '#cli/repository/configuration/sqlfluff.ts';
import { kitSection } from '#cli/repository/configuration/configuration-section.ts';

const STRUCTURED_PARSERS: Record<string, (text: string) => unknown> = {
    '.toml': parseToml,
    '.yaml': parseYaml,
    '.yml': parseYaml,
    '.json': (text) => JSON.parse(text) as unknown,
    '.jsonc': parseJsonc,
    '.json5': (text) => JSON5.parse(text),
};

const NATIVE_PARSERS: Record<string, (text: string, path: string) => unknown> = {
    sqlfluff: (text, path) => {
        if (posix.basename(path) === '.sqlfluffignore') return {};
        return Object.fromEntries(
            [...sqlfluffConfiguration(text)].map(([section, input]) => [section, Object.fromEntries(input)]),
        );
    },
    // EditorConfig is resolved through Prettier and retained, never retired as a parsed settings table.
    ec: () => ({}),
};

function parseSource(tool: string, path: string, text: string): unknown {
    const native = NATIVE_PARSERS[tool];
    if (native !== undefined) return native(text, path);
    if (tool === 'eslint' || /\.[cm]?[jt]s$/u.test(path))
        throw new Error('This configuration requires tool-specific evaluation.');
    if (tool === 'basedpyright') return parseJsonc(text);
    const parse = STRUCTURED_PARSERS[extname(path)];
    if (parse !== undefined) return parse(text);
    if (['prettier', 'markdownlint-cli2', 'stylelint', 'yamllint'].includes(tool)) return parseYaml(text) as unknown;
    return {};
}

/**
 * Capture original UTF-8 configuration bytes and permissions through the files reader.
 * @param root the repository root
 * @param path the authored configuration file
 * @returns the file text with the snapshot of its bytes and mode
 */
export function observeConfiguration(root: string, path: string): Omit<ConfigurationSource, 'parsed'> {
    const files = openRoot(root);
    try {
        const original = files.read(path);
        if (original === undefined) throw new Error('Configuration disappeared before it could be read.');
        const text = original.bytes.toString('utf8');
        if (!Buffer.from(text).equals(original.bytes)) throw new Error('Configuration must be UTF-8 text.');
        return { text, original };
    } finally {
        files.close();
    }
}

/**
 * Parse static settings from the same bytes used for mutation authorization.
 * @param original the snapshot of the authored file.
 * @param tool the tool whose format the file is in.
 * @param path the authored file's path.
 * @param selector the section of a shared file that holds the tool's settings, when it is one.
 * @param selector.table the table the settings live under.
 * @param selector.key the key that holds them.
 * @returns the text, the parsed settings table, and the snapshot.
 */
export function parseConfigurationSource(
    original: FileObservation,
    tool: string,
    path: string,
    selector?: { table?: string; key?: string },
): ConfigurationSource {
    const text = original.bytes.toString('utf8');
    if (selector === undefined) {
        const parsed = asRaw(parseSource(tool, path, text));
        if (parsed === undefined) throw new Error('Configuration must contain a settings table.');
        return { original, text, parsed };
    }
    const selected = kitSection(text, path, selector);
    if (selected === undefined) throw new Error('The selected kit section disappeared.');
    const source = { original, text: selected.text };
    const parsed = tool === 'sqlfluff' ? parseSource(tool, path, source.text) : selected.parsed;
    const table = asRaw(parsed);
    if (table === undefined) throw new Error('Configuration must contain a settings table.');
    return { ...source, parsed: table };
}

/**
 * A parsed value as a table.
 * @param value the parsed value
 * @returns the table, or undefined when the value is not one
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A parsed value as a table. 6 files make 15 calls; one owner keeps that behavior in one place.
export function asRaw(value: unknown): TomlTable | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as TomlTable) : undefined;
}

/**
 * A parsed value as a list.
 * @param value the parsed value
 * @returns the list, or an empty one when the value is not a list
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A parsed value as a list. 4 files make 4 calls; one owner keeps that behavior in one place.
export function asList(value: unknown): unknown[] {
    return Array.isArray(value) ? (value as unknown[]) : [];
}

/**
 * A parsed value as a list of strings.
 * @param value the parsed value
 * @returns the items as strings, or an empty list when the value is not a list
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A parsed value as a list of strings. 5 files make 9 calls; one owner keeps that behavior in one place.
export function asStrings(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String) : [];
}

/**
 * A parsed value as text.
 * @param value the parsed value
 * @returns the string, or undefined when the value is not one
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A parsed value as text. 4 files make 7 calls; one owner keeps that behavior in one place.
export function asText(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}
