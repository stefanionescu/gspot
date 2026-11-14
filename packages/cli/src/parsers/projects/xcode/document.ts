import { GspotError } from '#cli/system/errors.ts';
import { pbxprojSchema } from '#cli/schemas/parsers.ts';
import { OCTAL_RADIX, HEXADECIMAL_RADIX } from '#cli/config/system.ts';
import type { PbxElement, XcodeProject, ParsedPbxproj, ProjectTokens } from '#cli/types/parsers.ts';

import {
    PROJECT_ESCAPE,
    PROJECT_TOKENS,
    PROJECT_ESCAPES,
    OCTAL_ESCAPE_START,
    PROJECT_PUNCTUATION,
    MISSING_ROOT_MESSAGE,
    TRAILING_TEXT_MESSAGE,
    INVALID_STRING_MESSAGE,
} from '#cli/config/parsers/projects.ts';

function parseProjectString(token: string | undefined): string {
    if (token === undefined || PROJECT_PUNCTUATION.has(token)) throw new Error(INVALID_STRING_MESSAGE);
    if (!token.startsWith('"')) return token;
    return token.slice(1, -1).replace(PROJECT_ESCAPE, (escape: string, sequence: string) => {
        if (sequence.startsWith('U'))
            return String.fromCodePoint(Number.parseInt(sequence.slice(1), HEXADECIMAL_RADIX));
        return OCTAL_ESCAPE_START.test(sequence)
            ? String.fromCodePoint(Number.parseInt(sequence, OCTAL_RADIX))
            : (PROJECT_ESCAPES[sequence] ?? escape);
    });
}

function expectProjectToken(tokens: ProjectTokens, expected: string): void {
    if (tokens.tokens[tokens.index] !== expected) throw new Error(`The Xcode project requires ${expected}.`);
    tokens.index += 1;
}

function parseProjectArray(tokens: ProjectTokens): unknown[] {
    const values: unknown[] = [];
    while (tokens.tokens[tokens.index] !== ')') {
        values.push(parseProjectValue(tokens));
        if (tokens.tokens[tokens.index] !== ',') break;
        tokens.index += 1;
    }
    expectProjectToken(tokens, ')');
    return values;
}

function parseProjectDictionary(tokens: ProjectTokens): Record<string, unknown> {
    const pairs: Array<[string, unknown]> = [];
    while (tokens.tokens[tokens.index] !== '}') {
        const key = parseProjectString(tokens.tokens[tokens.index++]);
        expectProjectToken(tokens, '=');
        pairs.push([key, parseProjectValue(tokens)]);
        expectProjectToken(tokens, ';');
    }
    expectProjectToken(tokens, '}');
    return Object.fromEntries(pairs);
}

function parseProjectValue(tokens: ProjectTokens): unknown {
    const text = tokens.tokens[tokens.index++];
    if (text === '{') return parseProjectDictionary(tokens);
    return text === '(' ? parseProjectArray(tokens) : parseProjectString(text);
}

function matchProjectToken(text: string, offset: number): RegExpExecArray | undefined {
    for (const matcher of PROJECT_TOKENS) {
        matcher.lastIndex = offset;
        const matched = matcher.exec(text);
        if (matched !== null) return matched;
    }
    return undefined;
}

function parseProjectDocument(text: string): unknown {
    const tokens: string[] = [];
    for (let offset = 0; offset < text.length;) {
        const match = matchProjectToken(text, offset);
        if (match === undefined) throw new Error(`The Xcode project has invalid syntax at offset ${String(offset)}.`);
        offset += match[0].length;
        const token = match[0];
        if (token.trim() !== '' && !token.startsWith('//') && !token.startsWith('/*')) tokens.push(token);
    }
    const state: ProjectTokens = { tokens, index: 0 };
    const value = parseProjectValue(state);
    if (state.index !== tokens.length) throw new Error(TRAILING_TEXT_MESSAGE);
    return value;
}

export function getElement(project: Pick<XcodeProject, 'objects'>, id: string): PbxElement {
    const found = Object.hasOwn(project.objects, id) ? project.objects[id] : undefined;
    if (found === undefined) throw new Error(`The Xcode project references an unknown object: ${id}.`);
    return found;
}

export function buildProjectParseError(path: string, error: unknown): GspotError {
    const reason = error instanceof Error ? error.message : String(error);
    const punctuation = reason.endsWith('.') ? '' : '.';
    return new GspotError(
        'parse',
        `${path} is not a valid Xcode project: ${reason}${punctuation} Fix the file, then run the command again.`,
        { cause: error },
    );
}

export function parsePbxproj(text: string, path: string): ParsedPbxproj {
    try {
        const project = pbxprojSchema.parse(parseProjectDocument(text));
        const root = Object.hasOwn(project.objects, project.rootObject)
            ? project.objects[project.rootObject]
            : undefined;
        if (root?.isa !== 'PBXProject') throw new Error(MISSING_ROOT_MESSAGE);
        return { objects: project.objects, root };
    } catch (error) {
        throw buildProjectParseError(path, error);
    }
}
