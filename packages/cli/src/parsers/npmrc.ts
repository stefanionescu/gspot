// Reads and edits .npmrc keys, keeping every other line as written.
import type { KeyPath, EditableFile } from '#cli/types/parsers/editable-file.ts';
import { NPMRC_LIST_SUFFIX, NPMRC_COMMENT_MARKS } from '#cli/config/parsers/npmrc.ts';

/**
 * Split one .npmrc line into its key and value.
 * @param line the text to split.
 * @returns the key and value, or undefined for a comment or a line without `=`.
 */
function readLine(line: string): { key: string; value: string } | undefined {
    const text = line.trim();
    const equals = text.indexOf('=');
    if (equals <= 0 || NPMRC_COMMENT_MARKS.some((mark) => text.startsWith(mark))) return undefined;
    const key = text.slice(0, equals).trim();
    return {
        key: key.endsWith(NPMRC_LIST_SUFFIX) ? key.slice(0, -NPMRC_LIST_SUFFIX.length) : key,
        value: text.slice(equals + 1).trim(),
    };
}

/**
 * Read the one key that a flat .npmrc key path names.
 * @param path where the file sits, for the error message.
 * @param keys the requested key path.
 * @returns the key.
 */
function readFlatKey(path: string, keys: KeyPath): string {
    const [key] = keys;
    if (keys.length !== 1 || typeof key !== 'string') throw new Error(`${path} holds only top-level keys.`);
    return key;
}

/**
 * Open an .npmrc file for key edits. Lines with other keys, comments, and tokens stay as written.
 * @param path where the file sits, for the error message.
 * @param source the .npmrc text.
 * @returns the editable file. A key on several lines reads as a list.
 */
export function openNpmrcFile(path: string, source: string): EditableFile {
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    let lines = source === '' ? [] : source.split(/\r?\n/u);
    if (lines.at(-1) === '') lines.pop();
    return {
        format: 'npmrc',
        getValue(keys) {
            const key = readFlatKey(path, keys);
            const values = lines.flatMap((line) => {
                const parsed = readLine(line);
                return parsed?.key === key ? [parsed.value] : [];
            });
            if (values.length === 0) return undefined;
            return values.length === 1 ? values[0] : values;
        },
        set(keys, value) {
            const key = readFlatKey(path, keys);
            const isOther = (line: string): boolean => readLine(line)?.key !== key;
            const first = lines.findIndex((line) => !isOther(line));
            const kept = lines.filter((line) => isOther(line));
            const items: unknown[] = Array.isArray(value) ? value : [value];
            // npm reads a list only from `key[]=` lines. Repeated `key=` lines keep the last value.
            const name = Array.isArray(value) ? `${key}${NPMRC_LIST_SUFFIX}` : key;
            const written = value === undefined ? [] : items.map((item) => `${name}=${String(item)}`);
            const at = first === -1 ? kept.length : lines.slice(0, first).filter((line) => isOther(line)).length;
            lines = [...kept.slice(0, at), ...written, ...kept.slice(at)];
        },
        getText: () => (lines.length === 0 ? '' : `${lines.join(newline)}${newline}`),
    };
}
