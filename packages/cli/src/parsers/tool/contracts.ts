import semver from 'semver';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { stripVTControlCharacters } from 'node:util';
import { isRecord } from '#cli/platform/contracts.ts';
import { NO_VERSION } from '#cli/config/parsers/tool/version.ts';
import type { DirectiveScan } from '#cli/types/parsers/nginx.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { TOOL_FILE_FORMATS } from '#cli/config/parsers/tool/tool-file.ts';
import type { ToolPin, ParsedToolVersion } from '#cli/types/parsers/tool.ts';

import {
    WORD_STOPS,
    ESCAPE_LENGTH,
    NGINX_ESCAPES,
    WORD_START_STOPS,
    NGINX_PUNCTUATION,
} from '#cli/config/parsers/nginx.ts';

// The closing quote of an argument that opens at start, or `-1` when the quote never closes.
function quotedEnd(text: string, start: number, quote: string): number {
    for (let at = start + 1; at < text.length; at += 1) {
        if (text[at] === '\\') at += 1;
        else if (text[at] === quote) return at;
    }
    return -1;
}

// The index past an escape pair or a braced variable that starts at at, or `-1` when neither starts there.
function protectedUnitEnd(text: string, at: number): number {
    const char = text[at];
    if (char === '\\') return at + 1 < text.length ? at + ESCAPE_LENGTH : -1;
    if (char !== '$' || text[at + 1] !== '{') return -1;
    const close = text.indexOf('}', at + '${'.length);
    return close === -1 ? -1 : close + 1;
}

// The index past one unit of a bare word: an escape pair, a braced variable, or one plain character.
function unitEnd(text: string, at: number, stops: RegExp): number {
    const special = protectedUnitEnd(text, at);
    if (special !== -1) return special;
    return stops.test(text[at] ?? '') ? at : at + 1;
}

// The index past the bare word that starts at at, or at itself when no word starts there.
function wordEnd(text: string, at: number): number {
    let end = unitEnd(text, at, WORD_START_STOPS);
    if (end === at) return at;
    while (end < text.length) {
        const next = unitEnd(text, end, WORD_STOPS);
        if (next === end) break;
        end = next;
    }
    return end;
}

// A comment: the hash to the end of the line.
function commentAt(text: string, at: number): DirectiveScan {
    const end = text.indexOf('\n', at);
    const stop = end === -1 ? text.length : end;
    return { token: text.slice(at, stop), end: stop };
}

// The comment, punctuation, quoted argument, or bare word at at; a character that starts none is skipped.
function scanAt(text: string, at: number): DirectiveScan {
    const char = text[at] ?? '';
    if (/\s/u.test(char)) return { token: undefined, end: at + 1 };
    if (char === '#') return commentAt(text, at);
    if (NGINX_PUNCTUATION.has(char)) return { token: char, end: at + 1 };
    const end = char === '"' || char === "'" ? quotedEnd(text, at, char) + 1 : wordEnd(text, at);
    return end <= at ? { token: undefined, end: at + 1 } : { token: text.slice(at, end), end };
}

// The tokens of an nginx configuration: comments, punctuation, quoted arguments, and bare words.
function tokenize(text: string): string[] {
    const found: string[] = [];
    let at = 0;
    while (at < text.length) {
        const scan = scanAt(text, at);
        if (scan.token !== undefined) found.push(scan.token);
        at = scan.end;
    }
    return found;
}

function parseToolFile(text: string, extension: string, path: string): unknown {
    switch (TOOL_FILE_FORMATS[extension]) {
        case 'json': {
            try {
                return JSON.parse(text) as unknown;
            } catch (error) {
                if (!(error instanceof SyntaxError)) throw error;
                throw new SyntaxError(`Cannot read tool configuration ${path}: ${error.message}`, { cause: error });
            }
        }
        case 'yaml': {
            return parseYaml(text) as unknown;
        }
        case 'toml': {
            return parseToml(text);
        }
        default: {
            throw new Error(`${path}: shared configuration format is unsupported.`);
        }
    }
}

function hasKeyPath(value: unknown, parts: string[]): boolean {
    let parsed = value;
    for (const part of parts) {
        if (!isRecord(parsed) || !Object.hasOwn(parsed, part)) return false;
        parsed = parsed[part];
    }
    return true;
}

function parseHeader(line: string): string | undefined {
    const trimmed = line.trim();
    const close = trimmed.indexOf(']');
    const tail = close === -1 ? '' : trimmed.slice(close + 1).trim();
    const isHeader =
        trimmed.startsWith('[') && close > 1 && (tail === '' || tail.startsWith('#') || tail.startsWith(';'));
    return isHeader ? trimmed.slice(1, close) : undefined;
}

function parsedVersion(text: string, tool: ToolPin): string | undefined {
    if (tool.version_pattern === undefined) return semver.coerce(text)?.version;
    const match = new RegExp(tool.version_pattern, 'u').exec(text);
    return match?.[1] ?? match?.[0];
}

function versionFailure(
    result: SpawnResult,
    tool: ToolPin,
    text: string,
    version: string | undefined,
): ParsedToolVersion | undefined {
    if (result.isTimedOut === true) return { state: 'error', note: `${tool.name} version inspection timed out.` };
    if (result.missing) return { state: 'missing', note: text };
    if (text.includes(NO_VERSION)) return { state: 'missing', note: 'not installed' };
    if (result.code !== (tool.version_exit_code ?? 0))
        return { state: 'error', note: `${tool.name} version inspection exited ${String(result.code)}: ${text}` };
    if (version === undefined && tool.kind === 'library')
        return { state: 'missing', note: `${tool.name} is not reported by its host version command.` };
    return undefined;
}

/**
 * Read directive arguments without changing quoted whitespace or treating comments as configuration.
 * @param text the nginx configuration text
 * @returns each directive as its name followed by its arguments
 */
export function parseDirectives(text: string): [string, ...string[]][] {
    const found: [string, ...string[]][] = [];
    let directive: string[] = [];
    for (const token of tokenize(text)) {
        if (token.startsWith('#')) continue;
        switch (token) {
            case '}': {
                directive = [];
                break;
            }
            case ';':
            case '{': {
                const [name, ...args] = directive;
                if (name !== undefined) found.push([name, ...args]);
                directive = [];
                break;
            }
            default: {
                directive.push(
                    token
                        .replace(/^(["'])([\s\S]*)\1$/u, '$2')
                        .replaceAll(/\\([trn"'\\])/gu, (_, escaped: string) => NGINX_ESCAPES[escaped] ?? escaped),
                );
            }
        }
    }
    return found;
}

/**
 * Whether a shared tool file contains the declared key or table.
 * @param text the authored file text
 * @param path the file path, whose extension names the format
 * @param selector the key or table that the tool owns
 * @returns whether that section exists
 */
export function hasToolSection(
    text: string,
    path: string,
    selector: Pick<NonNullable<ToolPin['replace']>[number], 'key' | 'table'>,
): boolean {
    const extension = extname(path);
    if (selector.table !== undefined && (extension === '.ini' || extension === '.cfg'))
        return getIniSection(text, selector.table) !== undefined;
    const parts = selector.key === undefined ? (selector.table?.split('.') ?? []) : [selector.key];
    return hasKeyPath(parseToolFile(text, extension, path), parts);
}

/**
 * Select one INI section and its colon-delimited subsections without changing their text.
 * @param text the INI text
 * @param section the section name
 * @returns the section text, or undefined when the file has no such section
 */
export function getIniSection(text: string, section: string): string | undefined {
    const seen = new Set<string>();
    let included = false;
    const selected = text.split('\n').flatMap((line) => {
        const header = parseHeader(line);
        if (header === undefined) return included ? [line] : [];
        included = header === section || header.startsWith(`${section}:`);
        if (!included) return [];
        if (seen.has(header)) throw new Error(`Duplicate configuration section: ${header}`);
        seen.add(header);
        return [line];
    });
    return selected.length === 0 ? undefined : selected.join('\n');
}

/**
 * Interpret an executable version response for both installation and later inspections.
 * @param tool the pin.
 * @param result what the version command printed and how it exited.
 * @param installedPackage the version the npm tool package declares, when the tool is one.
 * @returns the version, or the state and note of a tool that gave none.
 */
export function parseVersionOutput(tool: ToolPin, result: SpawnResult, installedPackage?: string): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    // A shim with no selected version starts nothing, regardless of other mise installations.
    const version = (npm?.version === tool.version ? installedPackage : undefined) ?? parsedVersion(text, tool);
    const failure = versionFailure(result, tool, text, version);
    if (failure !== undefined) return failure;
    if (version === undefined || semver.coerce(version) === null)
        return { state: 'error', note: `${tool.name} did not report a valid version: ${text}` };
    return { version };
}
