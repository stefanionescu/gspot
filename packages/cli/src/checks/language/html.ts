import type { Node } from 'web-tree-sitter';
import { decodeHTMLAttribute } from 'entities';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildFinding, getNodePlace } from '#cli/runs/finding.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';
import type { SourceTree } from '#cli/types/parsers/code/grammars.ts';
import type { MarkupAttribute } from '#cli/types/checks/language/html.ts';

import {
    SCRIPT_SCHEMES,
    URL_ATTRIBUTES,
    EVENT_ATTRIBUTE,
    RELATIVE_URL_BASE,
    SURROUNDING_QUOTES,
    ACTIVE_DOCUMENT_TYPES,
    EXECUTABLE_SCRIPT_TYPES,
    DOCUMENT_URL_ATTRIBUTES,
} from '#cli/config/checks/language/html.ts';

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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function findScriptType(attributes: MarkupAttribute[]): string {
    return (
        attributes
            .find((attribute) => attribute.name === 'type')
            ?.value.trim()
            .toLowerCase() ?? ''
    );
}

function isActiveResource(attribute: MarkupAttribute, url: URL, scriptType: string): boolean {
    if (attribute.element === 'script') return EXECUTABLE_SCRIPT_TYPES.has(scriptType);
    const attributes = DOCUMENT_URL_ATTRIBUTES[attribute.element];
    if (attributes?.includes(attribute.name) !== true) return false;
    const mediaType = url.pathname.split(',', 1)[0]?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    return ACTIVE_DOCUMENT_TYPES.has(mediaType);
}

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
            if (
                !EXECUTABLE_SCRIPT_TYPES.has(findScriptType(attributes)) ||
                attributes.some((each) => each.name === 'src')
            )
                return [];
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
        const scriptType = findScriptType(attributes);
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
Reports inline scripts, handler attributes, and script links in each HTML file.

@param session the repository and its tools.
@param planned the scope HTML files.
@returns the findings.
*/
export async function checkHtmlInlineScripts(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ reads: session.reads, resources: session.resources, files }, (source) => {
        findings.push(...checkInlineScripts(planned, source), ...checkScriptAttributes(planned, source));
    });
    return findings;
}
