import type { Node } from 'web-tree-sitter';
import { decodeHTMLAttribute } from 'entities';
import type { Session } from '#cli/types/tools.ts';
import type { SourceTree } from '#cli/types/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { MarkupAttribute } from '#cli/types/configurations/language.ts';
import { HTML_EXPLANATIONS } from '#cli/configurations/language/html/explanations.ts';

import {
    HTML_RULES,
    SCRIPT_SCHEMES,
    URL_ATTRIBUTES,
    EVENT_ATTRIBUTE,
    RELATIVE_URL_BASE,
    SURROUNDING_QUOTES,
    ACTIVE_DOCUMENT_TYPES,
    INLINE_SCRIPT_MESSAGE,
    DOCUMENT_URL_ATTRIBUTES,
    EXECUTABLE_SCRIPT_TYPES,
} from '#cli/config/configurations/html.ts';

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

function isActiveResource(attribute: MarkupAttribute, url: URL, scriptType: string): boolean {
    if (attribute.element === 'script') return EXECUTABLE_SCRIPT_TYPES.has(scriptType);
    const attributes = DOCUMENT_URL_ATTRIBUTES.get(attribute.element);
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

function getScriptType(attributes: MarkupAttribute[]): string {
    return decodeHTMLAttribute(attributes.find((attribute) => attribute.name === 'type')?.value ?? '')
        .trim()
        .toLowerCase();
}

function validateInlineScripts(source: SourceTree): CheckFinding[] {
    return source.rootNode
        .descendantsOfType('script_element')
        .filter((element) =>
            element.namedChildren.some((child) => child.type === 'raw_text' && child.text.trim() !== ''),
        )
        .flatMap((element) => {
            const attributes = listElementAttributes(element);
            if (
                !EXECUTABLE_SCRIPT_TYPES.has(getScriptType(attributes)) ||
                attributes.some((each) => each.name === 'src')
            )
                return [];
            return [
                {
                    file: source.path,
                    line: element.startPosition.row + 1,
                    column: element.startPosition.column + 1,
                    rule: HTML_RULES.inlineScript,
                    message: INLINE_SCRIPT_MESSAGE,
                },
            ];
        });
}

function validateScriptAttributes(source: SourceTree): CheckFinding[] {
    return source.rootNode.descendantsOfType(['element', 'script_element']).flatMap((element) => {
        const attributes = listElementAttributes(element);
        const scriptType = getScriptType(attributes);
        return attributes.flatMap((attribute): CheckFinding[] => {
            const position = {
                file: source.path,
                line: attribute.node.startPosition.row + 1,
                column: attribute.node.startPosition.column + 1,
            };
            if (EVENT_ATTRIBUTE.test(attribute.name))
                return [
                    {
                        ...position,
                        rule: HTML_RULES.handlerAttribute,
                        message: `The ${attribute.name} attribute is inline script. Attach the handler from a script file.`,
                    },
                ];
            const scheme = findScriptScheme(attribute, scriptType);
            return scheme === undefined
                ? []
                : [
                      {
                          ...position,
                          rule: HTML_RULES.scriptLink,
                          message: `A ${scheme} URL embeds executable content. Use an external file.`,
                      },
                  ];
        });
    });
}

async function checkHtmlInlineScripts(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'html' as const }));
    const findings: CheckFinding[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        findings.push(...validateInlineScripts(source), ...validateScriptAttributes(source));
    });
    return findings;
}

export const HTML_CHECKS: Readonly<Record<string, CheckCode>> = {
    'html/inline-scripts': { check: checkHtmlInlineScripts, explanations: HTML_EXPLANATIONS },
};
