import { decodeHTMLAttribute } from 'entities';
import type { Finding } from '#cli/types/runs/check.ts';
import { listElementAttributes } from '#cli/parsers/html.ts';
import { visitParsedSources } from '#cli/parsers/grammars.ts';
import { locateNode, buildFinding } from '#cli/runs/finding.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { SourceTree, MarkupAttribute } from '#cli/types/parsers/grammars.ts';

import {
    SCRIPT_SCHEMES,
    URL_ATTRIBUTES,
    EVENT_ATTRIBUTE,
    RELATIVE_URL_BASE,
    INERT_SCRIPT_TYPES,
    ACTIVE_DOCUMENT_TYPES,
    DOCUMENT_URL_ATTRIBUTES,
} from '#cli/config/checks/html.ts';

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

function readScriptType(attributes: MarkupAttribute[]): string {
    return attributes.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
}

function checkInlineScripts(planned: PlannedCheck, source: SourceTree): Finding[] {
    return source.rootNode
        .descendantsOfType('script_element')
        .filter((element) =>
            element.namedChildren.some((child) => child.type === 'raw_text' && child.text.trim() !== ''),
        )
        .flatMap((element) => {
            const attributes = listElementAttributes(element);
            const scriptType = readScriptType(attributes);
            if (INERT_SCRIPT_TYPES.has(scriptType) || attributes.some((entry) => entry.name === 'src')) return [];
            return [
                buildFinding(
                    planned,
                    locateNode(source.path, element),
                    'inline-script',
                    'Move executable inline script to a script file.',
                ),
            ];
        });
}

function checkScriptAttributes(planned: PlannedCheck, source: SourceTree): Finding[] {
    return source.rootNode.descendantsOfType(['element', 'script_element']).flatMap((element) => {
        const attributes = listElementAttributes(element);
        const scriptType = readScriptType(attributes);
        return attributes.flatMap((attribute) => {
            const position = locateNode(source.path, attribute.node);
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
export async function checkHtmlScripts(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: Finding[] = [];
    await visitParsedSources({ reads: session.reads, resources: session.resources, files }, (source) =>
        findings.push(...checkInlineScripts(planned, source), ...checkScriptAttributes(planned, source)),
    );
    return findings;
}
