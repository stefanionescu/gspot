import type { Node } from 'web-tree-sitter';
import { decodeHTMLAttribute } from 'entities';
import { findingAt } from '#cli/checks/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import type { ParsedSource } from '#cli/types/parsers/source.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import type { MarkupAttribute } from '#cli/types/checks/language/html.ts';

import {
    LETTERS,
    SHOWN_TEXT,
    URL_ATTRIBUTES,
    COPY_ATTRIBUTES,
    PLACEHOLDER_MARKS,
    INERT_SCRIPT_TYPES,
    ACTIVE_DOCUMENT_TYPES,
    DOCUMENT_URL_ATTRIBUTES,
} from '#cli/config/checks/language/html.ts';

// Remove each delimiter kind in order so an inner placeholder cannot cut an outer interpolation short.
function withoutPlaceholders(text: string): string {
    let rest = text;
    for (const [open, close] of PLACEHOLDER_MARKS) {
        let start = rest.indexOf(open);
        while (start !== -1) {
            const end = rest.indexOf(close, start + open.length);
            if (end === -1) break;
            rest = rest.slice(0, start) + rest.slice(end + close.length);
            start = rest.indexOf(open);
        }
    }
    return rest;
}

function getAttributes(element: Node): MarkupAttribute[] {
    const tag = element.namedChildren.find((child) => child.type === 'start_tag' || child.type === 'self_closing_tag');
    const name = tag?.namedChildren.find((child) => child.type === 'tag_name')?.text.toLowerCase() ?? '';
    return (tag?.namedChildren ?? [])
        .filter((child) => child.type === 'attribute')
        .map((node) => ({
            node,
            element: name,
            name: node.namedChildren[0]?.text.toLowerCase() ?? '',
            value: (node.namedChildren[1]?.text ?? '').replaceAll(/^["']|["']$/gu, ''),
        }));
}

// Script and active-document contexts can execute data URLs. Image and text resources are inert.
function isActiveResource(attribute: MarkupAttribute, url: URL, scriptType: string): boolean {
    if (attribute.element === 'script') return !INERT_SCRIPT_TYPES.has(scriptType);
    if (DOCUMENT_URL_ATTRIBUTES[attribute.element]?.includes(attribute.name) !== true) return false;
    const mediaType = url.pathname.split(',', 1)[0]?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    return ACTIVE_DOCUMENT_TYPES.has(mediaType);
}

// Decode HTML character references before URL parsing removes embedded tabs and newlines.
function scriptScheme(attribute: MarkupAttribute, scriptType: string): string | undefined {
    if (!URL_ATTRIBUTES.has(attribute.name)) return undefined;
    const url = URL.parse(decodeHTMLAttribute(attribute.value), 'https://example.invalid');
    switch (url?.protocol) {
        case 'javascript:':
        case 'vbscript:': {
            return url.protocol;
        }
        case 'data:': {
            return isActiveResource(attribute, url, scriptType) ? url.protocol : undefined;
        }
        default: {
            return undefined;
        }
    }
}

function literalFindings(input: EngineInput, source: ParsedSource): Finding[] {
    const texts = source.rootNode
        .descendantsOfType('text')
        .filter((node) => LETTERS.test(withoutPlaceholders(node.text)))
        .map((node) =>
            findingAt(
                input,
                { file: source.path, line: node.startPosition.row + 1, column: node.startPosition.column + 1 },
                'literal-text',
                `Replace the text "${node.text.trim().slice(0, SHOWN_TEXT)}" with a placeholder for this template's content source.`,
            ),
        );
    const attributes = source.rootNode.descendantsOfType('element').flatMap((element) =>
        getAttributes(element)
            .filter(
                (attribute) =>
                    COPY_ATTRIBUTES.has(attribute.name) && LETTERS.test(withoutPlaceholders(attribute.value)),
            )
            .map((attribute) =>
                findingAt(
                    input,
                    {
                        file: source.path,
                        line: attribute.node.startPosition.row + 1,
                        column: attribute.node.startPosition.column + 1,
                    },
                    'literal-attribute',
                    `The ${attribute.name} attribute holds literal text. Use a placeholder.`,
                ),
            ),
    );
    return [...texts, ...attributes];
}

function inlineFindings(input: EngineInput, source: ParsedSource): Finding[] {
    return source.rootNode
        .descendantsOfType('script_element')
        .filter((element) =>
            element.namedChildren.some((child) => child.type === 'raw_text' && child.text.trim() !== ''),
        )
        .flatMap((element) => {
            const attributes = getAttributes(element);
            const scriptType = attributes.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
            if (INERT_SCRIPT_TYPES.has(scriptType) || attributes.some((entry) => entry.name === 'src')) return [];
            return [
                findingAt(
                    input,
                    {
                        file: source.path,
                        line: element.startPosition.row + 1,
                        column: element.startPosition.column + 1,
                    },
                    'inline-script',
                    'Move executable inline script to a script file.',
                ),
            ];
        });
}

function attributeFindings(input: EngineInput, source: ParsedSource): Finding[] {
    return source.rootNode.descendantsOfType(['element', 'script_element']).flatMap((element) => {
        const attributes = getAttributes(element);
        const scriptType = attributes.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
        return attributes.flatMap((attribute) => {
            const position = {
                file: source.path,
                line: attribute.node.startPosition.row + 1,
                column: attribute.node.startPosition.column + 1,
            };
            if (/^on[a-z]+$/u.test(attribute.name))
                return [
                    findingAt(
                        input,
                        position,
                        'handler-attribute',
                        `The ${attribute.name} attribute is inline script. Attach the handler from a script file.`,
                    ),
                ];
            const scheme = scriptScheme(attribute, scriptType);
            return scheme === undefined
                ? []
                : [
                      findingAt(
                          input,
                          position,
                          'script-link',
                          `A ${scheme} URL embeds executable content. Use an external file.`,
                      ),
                  ];
        });
    });
}

/**
 * Inline script, handler attributes and script links in every owned HTML file.
 * @param input the engine input
 * @returns the findings
 */
export async function scripts(input: EngineInput): Promise<Finding[]> {
    const files = input.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) =>
        findings.push(...inlineFindings(input, source), ...attributeFindings(input, source)),
    );
    return findings;
}

/**
 * Literal copy in the template files the policy names. With no template files the check passes.
 * @param input the engine input
 * @returns the findings
 */
export async function literals(input: EngineInput): Promise<Finding[]> {
    const tool = input.view.options('html');
    const templates = (tool['templates'] as string[] | undefined) ?? [];
    if (templates.length === 0) return [];
    const excluded = ((tool['literals_allowed'] as PathAllowance[] | undefined) ?? []).flatMap((entry) => entry.paths);
    const isTemplate = pathMatcher(templates);
    const isExcluded = pathMatcher(excluded);
    const files = input.files
        .filter((file) => isTemplate(file.path) && !isExcluded(file.path))
        .map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) => findings.push(...literalFindings(input, source)));
    return findings;
}
