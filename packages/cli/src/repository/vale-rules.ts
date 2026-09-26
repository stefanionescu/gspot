import type { Reader, Section } from '#cli/types/repository/repository.ts';
import { BYTE_ORDER_MARK, KEY_QUOTES, VALUE_QUOTES } from '#cli/constants/repository/repository.ts';

// The key and the value text of a plain option line: the key, then = or :, then the rest.
function plainEntry(line: string): [string | undefined, string] {
    const keyEnd = line.search(/[=:]/u);
    if (keyEnd === -1) return [undefined, ''];
    return [line.slice(0, keyEnd).trim(), line.slice(keyEnd + 1).trimStart()];
}

// The key and the value text of an option line whose key is quoted.
function quotedEntry(line: string, quote: string): [string | undefined, string] {
    const keyEnd = line.indexOf(quote, 1);
    if (keyEnd === -1) return [undefined, ''];
    const rest = line.slice(keyEnd + 1).trimStart();
    if (!rest.startsWith('=') && !rest.startsWith(':')) return [undefined, ''];
    return [line.slice(1, keyEnd), rest.slice(1).trimStart()];
}

// The key and the value text of one Vale option line: the key plain or quoted, then = or :, then the rest.
function valeEntry(line: string): [string | undefined, string] {
    const quote = KEY_QUOTES.find((candidate) => line.startsWith(candidate));
    return quote === undefined ? plainEntry(line) : quotedEntry(line, quote);
}

// A value without the matching quotes around it.
function unquoted(value: string): string {
    const isDouble = value.startsWith('"') && value.endsWith('"');
    const isSingle = value.startsWith("'") && value.endsWith("'");
    return isDouble || isSingle ? value.slice(1, -1) : value;
}

// A plain value: continued across backslash line ends, then stripped of a trailing comment and its quotes.
function plainValue(reader: Reader, start: string): string {
    let value = start;
    while (value.endsWith('\\')) {
        reader.index += 1;
        const next = reader.lines[reader.index];
        if (next === undefined) throw new Error('Vale configuration ends with a line continuation.');
        value = value.slice(0, -1) + next.trim();
    }
    const comment = value.includes(' #') ? value.indexOf(' #') : value.indexOf(' ;');
    if (comment >= 0) value = value.slice(0, comment).trimEnd();
    return unquoted(value);
}

// A quoted value, which may span lines until its closing quote.
function quotedValue(reader: Reader, start: string, quote: string): string {
    let value = start.slice(quote.length);
    while (!value.includes(quote)) {
        reader.index += 1;
        const next = reader.lines[reader.index];
        if (next === undefined) throw new Error('Unterminated Vale quoted value.');
        value += `\n${next}`;
    }
    return value.slice(0, value.lastIndexOf(quote));
}

// The value of an option, read past the current line when it continues.
function optionValue(reader: Reader, rest: string): string {
    const quote = VALUE_QUOTES.find((candidate) => rest.startsWith(candidate));
    return quote === undefined ? plainValue(reader, rest) : quotedValue(reader, rest, quote);
}

// Whether a line carries nothing: blank or a comment.
function isSkipped(line: string): boolean {
    return line === '' || line.startsWith('#') || line.startsWith(';');
}

// The section a header line opens, created when the file has not named it yet.
function openSection(sections: Map<string, Section>, line: string, lineNumber: number): Section {
    const end = line.lastIndexOf(']');
    if (end === -1) throw new Error(`Unclosed Vale section on line ${String(lineNumber)}.`);
    const name = line.slice(1, end);
    const section = sections.get(name) ?? new Map<string, string[]>();
    sections.set(name, section);
    return section;
}

// Records one option line in its section, keeping every distinct value in order.
function readOption(reader: Reader, line: string, section: Section): void {
    const [key, rest] = valeEntry(line);
    if (key === undefined || key === '') throw new Error(`Invalid Vale option on line ${String(reader.index + 1)}.`);
    const value = optionValue(reader, rest);
    const values = section.get(key) ?? [];
    if (!values.includes(value)) values.push(value);
    section.set(key, values);
}

// What a section says: the last level of each rule, and the styles it is based on.
function sectionSummary(entries: Section): { rules: Record<string, string | undefined>; BasedOnStyles: string[] } {
    const rules = [...entries]
        .filter(([key]) => key.includes('.'))
        .map(([key, values]): [string, string | undefined] => [key, values.at(-1)]);
    const styles = (entries.get('BasedOnStyles') ?? []).flatMap((value) =>
        value
            .split(',')
            .map((style) => style.trim())
            .filter(Boolean),
    );
    return { rules: Object.fromEntries(rules), BasedOnStyles: styles };
}

/**
 * Read Vale rule overrides and selected styles separately for each file-pattern section.
 * @param text the vale.ini text
 * @returns the styles and rule levels of each section
 */
export function valeRules(text: string): Record<string, unknown> {
    const sections = new Map<string, Section>();
    let section: Section = new Map();
    sections.set('DEFAULT', section);
    const reader: Reader = {
        lines: (text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text).split(/\r?\n/u),
        index: 0,
    };
    for (; reader.index < reader.lines.length; reader.index += 1) {
        const line = (reader.lines[reader.index] ?? '').trim();
        if (isSkipped(line)) continue;
        if (line.startsWith('[')) section = openSection(sections, line, reader.index + 1);
        else readOption(reader, line, section);
    }
    return Object.fromEntries([...sections].map(([name, entries]) => [name, sectionSummary(entries)]));
}
