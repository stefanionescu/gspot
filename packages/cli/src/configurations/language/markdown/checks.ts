import { parse as parseToml } from '@decimalturn/toml-patch';
import { parse, type ParseError, type ParseOptions, printParseErrorCode } from 'jsonc-parser/lib/esm/main.js';
import { parseAllDocuments } from 'yaml';

import { SYNTAX_RULE } from '#cli/config/configurations/infrastructure.ts';
import {
    ANGLE_PLACEHOLDER,
    CAMEL_CASE_BOUNDARY,
    ELLIPSIS_ARGUMENTS,
    EMPTY_ARGUMENTS,
    FENCE_PARSERS,
    JSON_FENCE_OPTIONS,
    PLACEHOLDER_VALUE,
    SYNTAX_ERROR_MESSAGE,
} from '#cli/config/configurations/language.ts';
import { FENCE_GRAMMARS, JSONC_OPTIONS } from '#cli/config/parsers.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { listCodeFences } from '#cli/parsers/formats/markdown.ts';
import { readText } from '#cli/system/files/reads.ts';
import { getPosition } from '#cli/system/text.ts';
import type {
    FenceParser,
    FenceSyntaxError,
    FormatFenceParser,
    GrammarFenceParser,
} from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { CodeFence, ParseCache } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;

const EXPRESSION_FORMS = [
    ['(\n', '\n)'],
    ['({\n', '\n})'],
] as const;

const TYPE_FORMS = [
    ['type Fragment =\n', '\n;'],
    ['type Fragment = {\n', '\n};'],
] as const;

// Documentation often shows an expression, an object member, a type, or a call signature instead of a whole program.
const EXCERPT_FORMS: Readonly<Record<GrammarFenceParser, ReadonlyArray<readonly [string, string]>>> = {
    bash: [],
    javascript: EXPRESSION_FORMS,
    typescript: [...EXPRESSION_FORMS, ...TYPE_FORMS],
    tsx: [...EXPRESSION_FORMS, ...TYPE_FORMS],
    python: [['(\n', '\n)']],
};

function findJsonSyntaxError(body: string, options: ParseOptions): FenceSyntaxError | undefined {
    const errors: ParseError[] = [];
    parse(body, errors, options);
    const error = errors[0];
    if (error === undefined) return undefined;
    const message = printParseErrorCode(error.error)
        .replaceAll(CAMEL_CASE_BOUNDARY, (_pair, first: string, next: string) => `${first} ${next}`)
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
    grammar: GrammarFenceParser,
    body: string,
    cache: ParseCache,
): Promise<FenceSyntaxError | undefined> {
    using tree = await parseSource(grammar, body, cache);
    if (!tree.rootNode.hasError) return undefined;
    const forms = EXCERPT_FORMS[grammar];
    for (const [prefix, suffix] of forms) {
        using excerpt = await parseSource(grammar, `${prefix}${body}${suffix}`, cache);
        if (!excerpt.rootNode.hasError) return undefined;
    }
    const error = tree.rootNode.descendantsOfType('ERROR')[0] ?? tree.rootNode;
    return { line: error.startPosition.row + 1, message: SYNTAX_ERROR_MESSAGE };
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
    let body = fence.body.replaceAll(ELLIPSIS_ARGUMENTS, () => EMPTY_ARGUMENTS);
    if (parser === 'bash') body = body.replaceAll(ANGLE_PLACEHOLDER, () => PLACEHOLDER_VALUE);
    const error = (FENCE_GRAMMARS as readonly string[]).includes(parser)
        ? await findTreeSyntaxError(parser as GrammarFenceParser, body, cache)
        : FORMAT_FENCE_READERS[parser as keyof typeof FORMAT_FENCE_READERS](body);
    return error === undefined ? undefined : { ...error, line: fence.startLine + error.line };
}

async function validateCodeFences(text: string, cache: ParseCache): Promise<FenceSyntaxError[]> {
    const errors: FenceSyntaxError[] = [];
    for (const fence of listCodeFences(text)) {
        const parser = FENCE_PARSERS.get(fence.language.toLowerCase());
        const isElided = fence.body.split('\n').some((line) => ELLIPSIS_LINE.test(line));
        if (isElided || parser === undefined || fence.body.trim() === '') continue;
        const error = await findFenceSyntaxError(fence, parser, cache);
        if (error !== undefined) errors.push(error);
    }
    return errors;
}

async function checkFences(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const findings: CheckFinding[] = [];
    for (const file of planned.files) {
        const text = readText(session.cache, file.path);
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

export const MARKDOWN_CHECKS: Readonly<Record<string, CheckCode>> = {
    'markdown/fences': { check: checkFences },
};
