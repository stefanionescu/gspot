import JSON5 from 'json5';
import { parse as parseYaml } from 'yaml';
import { extname, posix } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { sqlfluffConfiguration } from '#cli/repository/sqlfluff.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { configurationSection } from '#cli/repository/configuration-section.ts';

const STRUCTURED_PARSERS: Record<string, (text: string) => unknown> = {
    '.toml': parseToml,
    '.yaml': parseYaml,
    '.yml': parseYaml,
    '.json': (text) => JSON.parse(text) as unknown,
    '.jsonc': parseJsonc,
    '.json5': (text) => JSON5.parse(text),
};

function parseSource(tool: string, path: string, text: string): unknown {
    if (tool === 'sqlfluff' && posix.basename(path) !== '.sqlfluffignore')
        return Object.fromEntries(
            [...sqlfluffConfiguration(text)].map(([section, values]) => [section, Object.fromEntries(values)]),
        );
    // EditorConfig is resolved through Prettier and retained, never retired as a parsed settings table.
    if (tool === 'ec') return {};
    if (tool === 'eslint' || /\.[cm]?[jt]s$/u.test(path))
        throw new Error('This configuration requires tool-specific evaluation.');
    if (tool === 'basedpyright') return parseJsonc(text);
    const parse = STRUCTURED_PARSERS[extname(path)];
    if (parse !== undefined) return parse(text);
    if (['prettier', 'markdownlint-cli2', 'stylelint', 'yamllint'].includes(tool)) return parseYaml(text) as unknown;
    return {};
}

/**
 * Capture original UTF-8 configuration bytes and permissions through the confined reader.
 * @param root
 * @param path
 */
export function observeConfiguration(root: string, path: string): Omit<CarrySource, 'parsed'> {
    const files = openConfinedRoot(root);
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
 * @param original
 * @param tool
 * @param path
 * @param selector
 * @param selector.table
 * @param selector.key
 */
export function parseCarrySource(
    original: FileSnapshot,
    tool: string,
    path: string,
    selector?: { table?: string; key?: string },
): CarrySource {
    const text = original.bytes.toString('utf8');
    const selected = selector === undefined ? undefined : configurationSection(text, path, selector);
    if (selector !== undefined && selected === undefined)
        throw new Error('The selected configuration section disappeared.');
    const source = { original, text: selected?.text ?? text };
    const parsed =
        tool === 'sqlfluff' || selected === undefined ? parseSource(tool, path, source.text) : selected.parsed;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('Configuration must contain a settings table.');
    return { ...source, parsed: parsed as TomlTable };
}

export type CarrySource = { text: string; parsed: TomlTable; original: FileSnapshot };
