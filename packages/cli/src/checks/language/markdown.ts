import { parseAllDocuments } from 'yaml';
import { read } from '#cli/system/files/reads.ts';
import { getPosition } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { SYNTAX_RULE } from '#cli/config/checks/syntax.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { listCodeFences } from '#cli/parsers/formats/markdown.ts';
import { JSONC_OPTIONS } from '#cli/config/parsers/formats/json.ts';
import type { CodeFence } from '#cli/types/parsers/formats/markdown.ts';
import type { ParseCache, GrammarName } from '#cli/types/parsers/code/grammars.ts';
import { parse, type ParseError, type ParseOptions, printParseErrorCode } from 'jsonc-parser';

import type {
    FenceParser,
    FenceSyntaxError,
    FormatFenceParser,
    GrammarFenceParser,
} from '#cli/types/checks/language/markdown.ts';
import {
    ELLIPSIS_LINE,
    FENCE_PARSERS,
    EMPTY_ARGUMENTS,
    ANGLE_PLACEHOLDER,
    OMITTED_BASH_LINE,
    PLACEHOLDER_VALUE,
    ELLIPSIS_ARGUMENTS,
    JSON_FENCE_OPTIONS,
    CAMEL_CASE_BOUNDARY,
    SYNTAX_ERROR_MESSAGE,
    GRAMMAR_FENCE_PARSERS,
    CAMEL_CASE_REPLACEMENT,
} from '#cli/config/checks/language/markdown.ts';

function findJsonSyntaxError(body: string, options: ParseOptions): FenceSyntaxError | undefined {
    const errors: ParseError[] = [];
    parse(body, errors, options);
    const error = errors[0];
    if (error === undefined) return undefined;
    const message = printParseErrorCode(error.error)
        .replaceAll(CAMEL_CASE_BOUNDARY, CAMEL_CASE_REPLACEMENT)
        .toLowerCase();
    return { line: getPosition(body, error.offset).line, message: `JSON syntax error: ${message}.` };
}

function findTomlSyntaxError(body: string): FenceSyntaxError | undefined {
    try {
        parseToml(body);
        return undefined;
    } catch (error) {
        if (!(error instanceof Error) || !('line' in error) || typeof error.line !== 'number') throw error;
        return { line: error.line, message: error.message.split('\n', 1).join('') };
    }
}

function findYamlSyntaxError(body: string): FenceSyntaxError | undefined {
    const error = parseAllDocuments(body).flatMap((document) => document.errors)[0];
    return error === undefined
        ? undefined
        : { line: getPosition(body, error.pos[0]).line, message: error.message.split('\n', 1).join('') };
}

async function findTreeSyntaxError(
    grammar: GrammarName,
    body: string,
    cache: ParseCache,
): Promise<FenceSyntaxError | undefined> {
    const tree = await parseSource(grammar, body, cache);
    try {
        if (!tree.rootNode.hasError) return undefined;
        const error = tree.rootNode.descendantsOfType('ERROR')[0] ?? tree.rootNode;
        return { line: error.startPosition.row + 1, message: SYNTAX_ERROR_MESSAGE };
    } finally {
        tree.delete();
    }
}

const FORMAT_FENCE_READERS: Record<FormatFenceParser, (body: string) => FenceSyntaxError | undefined> = {
    json: (body) => findJsonSyntaxError(body, JSON_FENCE_OPTIONS),
    jsonc: (body) => findJsonSyntaxError(body, JSONC_OPTIONS),
    toml: findTomlSyntaxError,
    yaml: findYamlSyntaxError,
};

async function findFenceSyntaxError(
    fence: CodeFence,
    parser: FenceParser,
    cache: ParseCache,
): Promise<FenceSyntaxError | undefined> {
    const omitted = parser === 'bash' ? OMITTED_BASH_LINE : '';
    let body = fence.body
        .split('\n')
        .map((line) => (ELLIPSIS_LINE.test(line) ? omitted : line))
        .join('\n')
        .replaceAll(ELLIPSIS_ARGUMENTS, () => EMPTY_ARGUMENTS);
    if (parser === 'bash') body = body.replaceAll(ANGLE_PLACEHOLDER, () => PLACEHOLDER_VALUE);
    const error = (GRAMMAR_FENCE_PARSERS as readonly string[]).includes(parser)
        ? await findTreeSyntaxError(parser as GrammarFenceParser, body, cache)
        : FORMAT_FENCE_READERS[parser as keyof typeof FORMAT_FENCE_READERS](body);
    return error === undefined ? undefined : { ...error, line: fence.startLine + error.line };
}

async function validateCodeFences(text: string, cache: ParseCache): Promise<FenceSyntaxError[]> {
    const errors: FenceSyntaxError[] = [];
    for (const fence of listCodeFences(text)) {
        const parser = FENCE_PARSERS.get(fence.language.toLowerCase());
        if (parser === undefined || fence.body.trim() === '') continue;
        const error = await findFenceSyntaxError(fence, parser, cache);
        if (error !== undefined) errors.push(error);
    }
    return errors;
}

/**
Reports invalid code fences at their error lines.

@param session the repository and its tools.
@param planned the scope Markdown files.
*/
export async function checkMarkdownFences(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const findings: CheckFinding[] = [];
    for (const file of planned.files) {
        const text = read(session.reads, file.path);
        const errors = await validateCodeFences(text, session);
        findings.push(
            ...errors.map((error) => ({
                file: file.path,
                line: error.line,
                rule: SYNTAX_RULE,
                message: `Fix this code example: ${error.message}`,
            })),
        );
    }
    return findings;
}
