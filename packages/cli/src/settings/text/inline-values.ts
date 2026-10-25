import { type KeyPath } from '#cli/types/parsers/editable-file.ts';
import { type TomlValue, type TomlComments } from '#cli/types/parsers/formats/toml.ts';
import { isTomlKind, getTomlRange, insertTomlComments } from '#cli/parsers/formats/toml.ts';

/**
Build the text of a nested TOML array or inline table, and keep its comments.

@param node the parsed value whose layout supplies the source ranges.
@param text the TOML source of those ranges.
@param path the setting key and array indexes for comment placement.
@param comments the `#` lines anchored to their original values.
@param indent spaces before each line of a multiline array.
@returns TOML value text with its anchored comments.
*/
export function encodeValue(
    node: TomlValue,
    text: string,
    path: KeyPath,
    comments: TomlComments,
    indent: string,
): string {
    if (isTomlKind(node, 'InlineArray')) {
        const isRuleList = path.toReversed()[1] === 'rules';
        const texts = node.items.map(({ item }, position) => {
            const keys = [...path, position];
            const notes = comments
                .values()
                .filter(({ path: note }) => isRuleList && keys.every((key, index) => note[index] === key))
                .map(({ path: field }) => insertTomlComments(comments, 'key', field, ''))
                .filter(Boolean)
                .toArray();
            return insertTomlComments(
                comments,
                'item',
                keys,
                insertTomlComments(
                    comments,
                    'header',
                    keys,
                    [...notes, encodeValue(item as TomlValue, text, keys, comments, indent)].join('\n'),
                ),
            );
        });
        return texts.some((element) => element.includes('\n'))
            ? `[\n${texts
                  .map((element) =>
                      `${element},`
                          .split('\n')
                          .map((line) => `${indent}${line}`)
                          .join('\n'),
                  )
                  .join('\n')}\n]`
            : `[${texts.join(', ')}]`;
    }
    if (isTomlKind(node, 'InlineTable')) {
        const fields = node.items.map(({ item }) => {
            const keyText = text.slice(getTomlRange(item.key)[0], getTomlRange(item.value)[0]);
            const valueText = encodeValue(item.value, text, [...path, ...item.key.value], comments, indent);
            return keyText + valueText;
        });
        return `{ ${fields.join(', ')} }`;
    }
    return text.slice(...getTomlRange(node));
}
