import { basename } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { alertsSchema } from '#cli/parsers/schema/vale.ts';
import type { ValeAlert, LineCursor, ValeAssignments } from '#cli/types/parsers/vale.ts';

import {
    KEY_QUOTES,
    URL_PACKAGE,
    ZIP_PACKAGE,
    VALUE_QUOTES,
    BYTE_ORDER_MARK,
    PACKAGE_FOLDERS,
} from '#cli/config/parsers/vale.ts';

// The key and the value text of a plain option line: the key, then = or :, then the rest.
function splitPlain(line: string): [string | undefined, string] {
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

// A value without the matching quotes around it.
function unquoted(value: string): string {
    const isDouble = value.startsWith('"') && value.endsWith('"');
    const isSingle = value.startsWith("'") && value.endsWith("'");
    return isDouble || isSingle ? value.slice(1, -1) : value;
}

// A plain value: continued across backslash line ends, then stripped of a trailing comment and its quotes.
function plainValue(reader: LineCursor, start: string): string {
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
function quotedValue(reader: LineCursor, start: string, quote: string): string {
    let value = start.slice(quote.length);
    while (!value.includes(quote)) {
        reader.index += 1;
        const next = reader.lines[reader.index];
        if (next === undefined) throw new Error('Unterminated Vale quoted value.');
        value += `\n${next}`;
    }
    return value.slice(0, value.lastIndexOf(quote));
}

// The section a header line opens, created when the file has not named it yet.
function openSection(sections: Map<string, ValeAssignments>, line: string, lineNumber: number): ValeAssignments {
    const end = line.lastIndexOf(']');
    if (end === -1) throw new Error(`Unclosed Vale section on line ${String(lineNumber)}.`);
    const name = line.slice(1, end);
    const section = sections.get(name) ?? new Map<string, string[]>();
    sections.set(name, section);
    return section;
}

// Records one option line in its section, keeping every distinct value in order.
function parseOption(reader: LineCursor, line: string, section: ValeAssignments): void {
    const keyQuote = KEY_QUOTES.find((candidate) => line.startsWith(candidate));
    const [key, rest] = keyQuote === undefined ? splitPlain(line) : quotedEntry(line, keyQuote);
    if (key === undefined || key === '') throw new Error(`Invalid Vale option on line ${String(reader.index + 1)}.`);
    const valueQuote = VALUE_QUOTES.find((candidate) => rest.startsWith(candidate));
    const value = valueQuote === undefined ? plainValue(reader, rest) : quotedValue(reader, rest, valueQuote);
    const assignments = section.get(key) ?? [];
    if (!assignments.includes(value)) assignments.push(value);
    section.set(key, assignments);
}

// Parse authored Vale package declarations while preserving multiline values.
function readSections(text: string): Map<string, ValeAssignments> {
    const sections = new Map<string, ValeAssignments>();
    let section: ValeAssignments = new Map();
    sections.set('DEFAULT', section);
    const reader: LineCursor = {
        lines: (text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text).split(/\r?\n/u),
        index: 0,
    };
    for (; reader.index < reader.lines.length; reader.index += 1) {
        const line = (reader.lines[reader.index] ?? '').trim();
        if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;
        if (line.startsWith('[')) section = openSection(sections, line, reader.index + 1);
        else parseOption(reader, line, section);
    }
    return sections;
}

/**
 * Read the upstream style folders declared by the Vale global Packages assignment.
 * @param text the vale.ini text
 * @returns the package folders, including auxiliary dictionaries the package installs
 */
export function parseValePackages(text: string): string[] {
    const configured = readSections(text).get('DEFAULT')?.get('Packages')?.at(-1) ?? '';
    const packages = configured
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '')
        .map((name) => basename(URL_PACKAGE.test(name) ? new URL(name).pathname : name).replace(ZIP_PACKAGE, ''));
    return [...packages, ...packages.flatMap((name) => PACKAGE_FOLDERS[name] ?? [])];
}

/**
 * Validates native Vale JSON before converting alerts to source locations.
 * @param stdout the output
 * @returns the alerts
 */
export function parseAlerts(stdout: string): ValeAlert[] {
    return Object.entries(alertsSchema.parse(JSON.parse(stdout))).flatMap(([file, alerts]) =>
        alerts.map((alert) => ({
            file: toPosix(file),
            line: alert.Line,
            column: alert.Span[0],
            check: alert.Check,
            message: alert.Message,
        })),
    );
}
