import type { Node } from 'web-tree-sitter';

import {
    ASTRO_EXTENSION,
    ASTRO_FRONT_MATTER,
    COMPONENT_EXTENSION,
    SCRIPT_LANGUAGE_ATTRIBUTE,
    TSX_LANGUAGES,
} from '#cli/config/parsers/code.ts';
import { findGrammarByExtension, parseSource } from '#cli/parsers/code/grammars.ts';
import { blankText, replaceRanges } from '#cli/system/text.ts';
import type { ComponentScript } from '#cli/types/parsers.ts';

function listComponentScripts(element: Node, text: string, masked: string): ComponentScript[] {
    const language = element.namedChildren
        .find((node) => node.type === 'start_tag')
        ?.text.match(SCRIPT_LANGUAGE_ATTRIBUTE)?.groups?.['language'];
    const grammar = TSX_LANGUAGES.includes(language ?? '') ? 'tsx' : 'typescript';
    return element.namedChildren
        .filter((child) => child.type === 'raw_text')
        .map((node) => ({
            grammar,
            source: replaceRanges(masked, text, [{ start: node.startIndex, end: node.endIndex }]),
        }));
}

/**
Read the markup and the scripts of a component, each padded so that its lines stay where the file has them.
*/
export async function parseComponentSources(
    text: string,
    path: string,
): Promise<{ markup: string; scripts: ComponentScript[] }> {
    const masked = blankText(text);
    const front = path.endsWith(ASTRO_EXTENSION) ? ASTRO_FRONT_MATTER.exec(text) : null;
    const markup = front === null ? text : masked.slice(0, front[0].length) + text.slice(front[0].length);
    using tree = await parseSource('html', markup);
    const scripts = tree.rootNode
        .descendantsOfType('script_element')
        .flatMap((element) => listComponentScripts(element, text, masked));
    if (front !== null) {
        const start = text.indexOf('\n') + 1;
        scripts.push({
            grammar: 'typescript',
            source: replaceRanges(masked, text, [{ start, end: start + (front[1] as string).length }]),
        });
    }
    return { markup, scripts };
}

export function getStringLiteral(node: Node | null | undefined): string | undefined {
    if (node?.type === 'string') return node.text.slice(1, -1);
    const isStaticTemplate =
        node?.type === 'template_string' && node.namedChildren.every(({ type }) => type !== 'template_substitution');
    return isStaticTemplate ? node.text.slice(1, -1) : undefined;
}

export async function listJavascriptSources(path: string, text: string): Promise<ComponentScript[]> {
    if (!COMPONENT_EXTENSION.test(path))
        return [{ grammar: findGrammarByExtension(path) ?? 'typescript', source: text }];
    const { scripts } = await parseComponentSources(text, path);
    return scripts;
}
