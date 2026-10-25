import { parseAllDocuments } from 'yaml';
import { getPosition } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
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
    GRAMMAR_FENCE_PARSERS,
} from '#cli/config/checks/language/markdown.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report a type predicate.
function isGrammarFenceParser(parser: FenceParser): parser is GrammarFenceParser {
    return (GRAMMAR_FENCE_PARSERS as readonly string[]).includes(parser);
}

function findJsonSyntaxError(body: string, options: ParseOptions): FenceSyntaxError | undefined {
    const errors: ParseError[] = [];
    parse(body, errors, options);
    const error = errors[0];
    if (error === undefined) return undefined;
    const message = printParseErrorCode(error.error).replaceAll(CAMEL_CASE_BOUNDARY, '$<first> $<next>').toLowerCase();
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
        return { line: error.startPosition.row + 1, message: 'Syntax error.' };
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
    const body = fence.body
        .split('\n')
        .map((line) => (ELLIPSIS_LINE.test(line) ? omitted : line))
        .join('\n')
        .replaceAll(ELLIPSIS_ARGUMENTS, () => EMPTY_ARGUMENTS)
        .replaceAll(ANGLE_PLACEHOLDER, () => PLACEHOLDER_VALUE);
    const error = isGrammarFenceParser(parser)
        ? await findTreeSyntaxError(parser, body, cache)
        : FORMAT_FENCE_READERS[parser](body);
    return error === undefined ? undefined : { ...error, line: fence.startLine + error.line };
}

async function validateCodeFences(text: string, cache: ParseCache): Promise<FenceSyntaxError[]> {
    const errors: FenceSyntaxError[] = [];
    for (const fence of listCodeFences(text)) {
        const parser = FENCE_PARSERS[fence.language];
        if (typeof parser !== 'string' || fence.body.trim() === '') continue;
        const error = await findFenceSyntaxError(fence, parser, cache);
        if (error !== undefined) errors.push(error);
    }
    return errors;
}

/**
Reports invalid code fences at their error lines.

@param session the repository and its tools.
@param planned the scope Markdown files.
@returns one finding per invalid code fence.
*/
export async function checkMarkdownFences(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const file of planned.files) {
        const text = readCachedText(session.reads, file.path);
        const errors = await validateCodeFences(text, session);
        findings.push(
            ...errors.map((error) =>
                buildFinding(
                    planned,
                    { file: file.path, line: error.line },
                    'syntax',
                    `Fix this code example: ${error.message}`,
                ),
            ),
        );
    }
    return findings;
}
