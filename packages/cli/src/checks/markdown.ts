import { parseAllDocuments } from 'yaml';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { computePosition } from '#cli/system/text.ts';
import { parseSource } from '#cli/parsers/grammars.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { listCodeFences } from '#cli/parsers/markdown.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { JSONC_OPTIONS } from '#cli/config/parsers/json.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import type { ParseCache, GrammarName } from '#cli/types/parsers/grammars.ts';
import type { FenceParser, FenceSyntaxError } from '#cli/types/checks/markdown.ts';
import { parse, type ParseError, type ParseOptions, printParseErrorCode } from 'jsonc-parser';

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
} from '#cli/config/checks/markdown.ts';

function findJsonSyntaxError(body: string, options: ParseOptions): FenceSyntaxError | undefined {
    const errors: ParseError[] = [];
    parse(body, errors, options);
    const error = errors[0];
    if (error === undefined) return undefined;
    const message = printParseErrorCode(error.error).replaceAll(CAMEL_CASE_BOUNDARY, '$<first> $<next>').toLowerCase();
    return { line: computePosition(body, error.offset).line, message: `JSON syntax error: ${message}.` };
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
    if (error === undefined) return undefined;
    return { line: computePosition(body, error.pos[0]).line, message: error.message.split('\n', 1).join('') };
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

/**
 * Parses language-tagged code fences and reports syntax errors at their Markdown lines.
 *
 * @param text the Markdown source.
 * @param cache the parsed grammars of the run.
 * @returns one syntax error per invalid code fence.
 */
async function validateCodeFences(text: string, cache: ParseCache): Promise<FenceSyntaxError[]> {
    const readers: Record<
        FenceParser,
        (body: string) => FenceSyntaxError | undefined | Promise<FenceSyntaxError | undefined>
    > = {
        json: (body) => findJsonSyntaxError(body, JSON_FENCE_OPTIONS),
        jsonc: (body) => findJsonSyntaxError(body, JSONC_OPTIONS),
        toml: findTomlSyntaxError,
        yaml: findYamlSyntaxError,
        bash: (body) => findTreeSyntaxError('bash', body, cache),
        typescript: (body) => findTreeSyntaxError('typescript', body, cache),
        tsx: (body) => findTreeSyntaxError('tsx', body, cache),
        javascript: (body) => findTreeSyntaxError('javascript', body, cache),
        python: (body) => findTreeSyntaxError('python', body, cache),
    };
    const errors: FenceSyntaxError[] = [];
    for (const fence of listCodeFences(text)) {
        const parser = FENCE_PARSERS[fence.language];
        if (typeof parser !== 'string' || fence.body.trim() === '') continue;
        // Omitted code and placeholder values keep their lines without becoming syntax errors.
        const omitted = parser === 'bash' ? OMITTED_BASH_LINE : '';
        const body = fence.body
            .split('\n')
            .map((line) => (ELLIPSIS_LINE.test(line) ? omitted : line))
            .join('\n')
            .replaceAll(ELLIPSIS_ARGUMENTS, EMPTY_ARGUMENTS)
            .replaceAll(ANGLE_PLACEHOLDER, PLACEHOLDER_VALUE);
        const error = await readers[parser](body);
        if (error !== undefined) errors.push({ ...error, line: fence.startLine + error.line });
    }
    return errors;
}

/**
 * Reports invalid code fences at their error lines.
 *
 * @param session the repository and its tools.
 * @param planned the scope Markdown files.
 * @returns one finding per invalid code fence.
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
