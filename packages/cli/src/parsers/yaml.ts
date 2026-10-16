// Reads and edits YAML keys. Comments and layout stay as written.
import { isMap, isNode, parseDocument } from 'yaml';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';

/**
 * Open YAML for key edits that keep the rest of the file as written.
 * @param path where the file sits, for the error message.
 * @param source the YAML text.
 * @returns the editable file.
 */
export function openYamlFile(path: string, source: string): EditableFile {
    const document = parseDocument(source);
    if (document.errors.length > 0) throw new Error(`${path} is not valid YAML. Fix the file, then run gspot apply.`);
    return {
        format: 'yaml',
        getValue(keys) {
            const value: unknown = document.getIn(keys, true);
            if (!isNode(value)) return value;
            const json: unknown = value.toJSON();
            return json;
        },
        set(keys, value) {
            if (value === undefined) document.deleteIn(keys);
            else document.setIn(keys, value);
        },
        getText() {
            const contents = document.contents;
            return contents === null || (isMap(contents) && contents.items.length === 0) ? '' : document.toString();
        },
    };
}
