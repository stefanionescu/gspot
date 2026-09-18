// Whether an old configuration file parses, so takeover neither loses its exceptions nor deletes it unread.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';

const STRUCTURED_PARSERS: [string[], (text: string) => unknown][] = [
    [['.toml'], (text) => parseToml(text)],
    [['.yml', '.yaml'], (text) => parseYaml(text) as unknown],
    [['.json'], (text) => JSON.parse(text) as unknown],
];

/**
 * Why a structured configuration file cannot be read, or undefined when it parses or has no structured format.
 * @param root the repository root
 * @param path the file, relative to the root
 * @returns what the parser said
 */
export function unreadableReason(root: string, path: string): string | undefined {
    const parse = STRUCTURED_PARSERS.find(([extensions]) =>
        extensions.some((extension) => path.endsWith(extension)),
    )?.[1];
    if (parse === undefined) return undefined;
    try {
        parse(readFileSync(join(root, path), 'utf8'));
        return undefined;
    } catch (error) {
        return (error as Error).message.split('\n', 1)[0] ?? 'it does not parse';
    }
}
