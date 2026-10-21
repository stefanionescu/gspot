import type { Node } from 'web-tree-sitter';
import { decodeHTMLAttribute } from 'entities';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { visitParsedSources } from '#cli/parsers/grammars.ts';
import type { MarkupAttribute } from '#cli/types/checks/html.ts';
import type { SourceTree } from '#cli/types/parsers/grammars.ts';
import { buildFinding, getNodePlace } from '#cli/runs/finding.ts';

import {
    SCRIPT_SCHEMES,
    URL_ATTRIBUTES,
    EVENT_ATTRIBUTE,
    RELATIVE_URL_BASE,
    INERT_SCRIPT_TYPES,
    SURROUNDING_QUOTES,
    ACTIVE_DOCUMENT_TYPES,
    DOCUMENT_URL_ATTRIBUTES,
} from '#cli/config/checks/html.ts';

/**
 * Read the tag attributes while the source tree still exists.
 *
 * @param element the parsed tag.
 * @returns the attributes, with their source nodes.
 */
function listElementAttributes(element: Node): MarkupAttribute[] {
    const tag = element.namedChildren.find((child) => child.type === 'start_tag' || child.type === 'self_closing_tag');
    const name = tag?.namedChildren.find((child) => child.type === 'tag_name')?.text.toLowerCase() ?? '';
    return (tag?.namedChildren ?? [])
        .filter((child) => child.type === 'attribute')
        .map((node) => ({
            node,
            element: name,
            name: node.namedChildren[0]?.text.toLowerCase() ?? '',
            value: (node.namedChildren[1]?.text ?? '').replaceAll(SURROUNDING_QUOTES, ''),
        }));
}

// Script and active-document contexts can execute data URLs. Image and text resources remain inert.
function isActiveResource(attribute: MarkupAttribute, url: URL, scriptType: string): boolean {
    if (attribute.element === 'script') return !INERT_SCRIPT_TYPES.has(scriptType);
    const attributes = DOCUMENT_URL_ATTRIBUTES[attribute.element];
    if (attributes?.includes(attribute.name) !== true) return false;
    const mediaType = url.pathname.split(',', 1)[0]?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    return ACTIVE_DOCUMENT_TYPES.has(mediaType);
}

// Decode HTML character references before URL parsing removes embedded tabs and newlines.
function findScriptScheme(attribute: MarkupAttribute, scriptType: string): string | undefined {
    if (!URL_ATTRIBUTES.has(attribute.name)) return undefined;
    const url = URL.parse(decodeHTMLAttribute(attribute.value), RELATIVE_URL_BASE);
    if (url === null) return undefined;
    if (SCRIPT_SCHEMES.has(url.protocol)) return url.protocol;
    return url.protocol === 'data:' && isActiveResource(attribute, url, scriptType) ? url.protocol : undefined;
}

function checkInlineScripts(planned: PlannedCheck, source: SourceTree): Finding[] {
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
                buildFinding(
                    planned,
                    getNodePlace(source.path, element),
                    'inline-script',
                    'Move executable inline script to a script file.',
                ),
            ];
        });
}

function checkScriptAttributes(planned: PlannedCheck, source: SourceTree): Finding[] {
    return source.rootNode.descendantsOfType(['element', 'script_element']).flatMap((element) => {
        const attributes = listElementAttributes(element);
        const scriptType = attributes.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
        return attributes.flatMap((attribute) => {
            const position = getNodePlace(source.path, attribute.node);
            if (EVENT_ATTRIBUTE.test(attribute.name))
                return [
                    buildFinding(
                        planned,
                        position,
                        'handler-attribute',
                        `The ${attribute.name} attribute is inline script. Attach the handler from a script file.`,
                    ),
                ];
            const scheme = findScriptScheme(attribute, scriptType);
            return scheme === undefined
                ? []
                : [
                      buildFinding(
                          planned,
                          position,
                          'script-link',
                          `A ${scheme} URL embeds executable content. Use an external file.`,
                      ),
                  ];
        });
    });
}

/**
 * Reports inline scripts, handler attributes, and script links in each HTML file.
 *
 * @param session the repository and its tools.
 * @param planned the scope HTML files.
 * @returns the findings.
 */
export async function checkHtmlInlineScripts(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ reads: session.reads, resources: session.resources, files }, (source) =>
        findings.push(...checkInlineScripts(planned, source), ...checkScriptAttributes(planned, source)),
    );
    return findings;
}
