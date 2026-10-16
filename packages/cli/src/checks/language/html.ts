import { decodeHTMLAttribute } from 'entities';
import { listElementAttributes } from '#cli/parsers/html.ts';
import { nodePlace, findingAt } from '#cli/checks/finding.ts';
import { visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import type { SourceTree, MarkupAttribute } from '#cli/types/parsers/tree-sitter.ts';

import {
    SCRIPT_SCHEMES,
    URL_ATTRIBUTES,
    EVENT_ATTRIBUTE,
    INERT_SCRIPT_TYPES,
    ACTIVE_DOCUMENT_TYPES,
    DOCUMENT_URL_ATTRIBUTES,
} from '#cli/config/checks/language/html.ts';

// Script and active-document contexts can execute data URLs. Image and text resources remain inert.
function isActiveResource(attribute: MarkupAttribute, url: URL, scriptType: string): boolean {
    if (attribute.element === 'script') return !INERT_SCRIPT_TYPES.has(scriptType);
    const attributes = DOCUMENT_URL_ATTRIBUTES[attribute.element];
    if (attributes?.includes(attribute.name) !== true) return false;
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

function inlineFindings(input: CheckInput, source: SourceTree): Finding[] {
    return source.rootNode
        .descendantsOfType('script_element')
        .filter((element) =>
            element.namedChildren.some((child) => child.type === 'raw_text' && child.text.trim() !== ''),
        )
        .flatMap((element) => {
            const attributes = listElementAttributes(element);
            const scriptType = attributes.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
            if (INERT_SCRIPT_TYPES.has(scriptType) || attributes.some((entry) => entry.name === 'src')) return [];
            return [
                findingAt(
                    input,
                    nodePlace(source.path, element),
                    'inline-script',
                    'Move executable inline script to a script file.',
                ),
            ];
        });
}

function attributeFindings(input: CheckInput, source: SourceTree): Finding[] {
    return source.rootNode.descendantsOfType(['element', 'script_element']).flatMap((element) => {
        const attributes = listElementAttributes(element);
        const scriptType = attributes.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
        return attributes.flatMap((attribute) => {
            const position = nodePlace(source.path, attribute.node);
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
async function htmlScripts(input: CheckInput): Promise<Finding[]> {
    const files = input.files.map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) =>
        findings.push(...inlineFindings(input, source), ...attributeFindings(input, source)),
    );
    return findings;
}

export { htmlScripts };
