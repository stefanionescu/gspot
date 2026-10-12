import { decodeHTMLAttribute } from 'entities';
import { findingAt } from '#cli/checks/finding.ts';
import { elementAttributes } from '#cli/parsers/html.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import type { SourceTree, MarkupAttribute } from '#cli/types/parsers/tree-sitter.ts';

import {
    LETTERS,
    SHOWN_TEXT,
    SCRIPT_SCHEMES,
    URL_ATTRIBUTES,
    COPY_ATTRIBUTES,
    EVENT_ATTRIBUTE,
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

// Script and active-document contexts can execute data URLs. Image and text resources remain inert.
function isActiveResource(attribute: MarkupAttribute, url: URL, scriptType: string): boolean {
    if (attribute.element === 'script') return !INERT_SCRIPT_TYPES.has(scriptType);
    const attributes = Object.entries(DOCUMENT_URL_ATTRIBUTES).find(([name]) => name === attribute.element)?.[1];
    if (attributes === undefined || !new Set<string>(attributes).has(attribute.name)) return false;
    const mediaType = url.pathname.split(',', 1)[0]?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    return ACTIVE_DOCUMENT_TYPES.has(mediaType);
}

// Decode HTML character references before URL parsing removes embedded tabs and newlines.
function scriptScheme(attribute: MarkupAttribute, scriptType: string): string | undefined {
    if (!URL_ATTRIBUTES.has(attribute.name)) return undefined;
    const url = URL.parse(decodeHTMLAttribute(attribute.value), 'https://example.invalid');
    if (url === null) return undefined;
    if (SCRIPT_SCHEMES.has(url.protocol)) return url.protocol;
    return url.protocol === 'data:' && isActiveResource(attribute, url, scriptType) ? url.protocol : undefined;
}

function literalFindings(input: CheckInput, source: SourceTree): Finding[] {
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
        elementAttributes(element)
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

function inlineFindings(input: CheckInput, source: SourceTree): Finding[] {
    return source.rootNode
        .descendantsOfType('script_element')
        .filter((element) =>
            element.namedChildren.some((child) => child.type === 'raw_text' && child.text.trim() !== ''),
        )
        .flatMap((element) => {
            const attributes = elementAttributes(element);
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

function attributeFindings(input: CheckInput, source: SourceTree): Finding[] {
    return source.rootNode.descendantsOfType(['element', 'script_element']).flatMap((element) => {
        const attributes = elementAttributes(element);
        const scriptType = attributes.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
        return attributes.flatMap((attribute) => {
            const position = {
                file: source.path,
                line: attribute.node.startPosition.row + 1,
                column: attribute.node.startPosition.column + 1,
            };
            if (EVENT_ATTRIBUTE.test(attribute.name))
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
 * @param input the check input.
 * @returns the findings.
 */
export async function htmlScripts(input: CheckInput): Promise<Finding[]> {
    const files = input.files.map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) =>
        findings.push(...inlineFindings(input, source), ...attributeFindings(input, source)),
    );
    return findings;
}

/**
 * Literal copy in the template files the settings names. With no template files the check passes.
 * @param input the check input.
 * @returns the findings.
 */
export async function htmlTemplateText(input: CheckInput): Promise<Finding[]> {
    const { templates } = input.selection.view.options('html');
    if (templates.length === 0) return [];
    const isTemplate = pathMatcher(templates);
    const files = input.files
        .filter((file) => isTemplate(file.path))
        .map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) => findings.push(...literalFindings(input, source)));
    return findings;
}
