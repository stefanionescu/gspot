import type { Node } from 'web-tree-sitter';
import { decodeHTMLAttribute } from 'entities';
import { pathMatcher } from '#cli/repository/paths.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { Finding, EngineInput, MarkupProblem, MarkupAttribute } from '#cli/types/checks/checks.ts';

import {
    LETTERS,
    SHOWN_TEXT,
    URL_ATTRIBUTES,
    COPY_ATTRIBUTES,
    PLACEHOLDER_MARKS,
    INERT_SCRIPT_TYPES,
    ACTIVE_DOCUMENT_TYPES,
    DOCUMENT_URL_ATTRIBUTES,
} from '#cli/config/checks/checks.ts';

// The text with every placeholder mark pair removed.
function withoutPlaceholders(text: string): string {
    let rest = text;
    for (const [open, close] of PLACEHOLDER_MARKS) rest = withoutMarks(rest, open, close);
    return rest;
}

function attributes(element: Node): MarkupAttribute[] {
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
function isActiveResource(attribute: MarkupAttribute, url: URL, kind: string): boolean {
    if (attribute.element === 'script') return !INERT_SCRIPT_TYPES.has(kind);
    if (DOCUMENT_URL_ATTRIBUTES[attribute.element]?.includes(attribute.name) !== true) return false;
    const mediaType = url.pathname.split(',', 1)[0]?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    return ACTIVE_DOCUMENT_TYPES.has(mediaType);
}

// Decode HTML character references before URL parsing removes embedded tabs and newlines.
function scriptScheme(attribute: MarkupAttribute, kind: string): string | undefined {
    if (!URL_ATTRIBUTES.has(attribute.name)) return undefined;
    const url = URL.parse(decodeHTMLAttribute(attribute.value), 'https://example.invalid');
    switch (url?.protocol) {
        case 'javascript:':
        case 'vbscript:': {
            return url.protocol;
        }
        case 'data:': {
            return isActiveResource(attribute, url, kind) ? url.protocol : undefined;
        }
        default: {
            return undefined;
        }
    }
}

function scriptProblems(root: Node): MarkupProblem[] {
    const inline = root.descendantsOfType('script_element').flatMap((element): MarkupProblem[] => {
        const held = attributes(element);
        const kind = held.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
        const body = element.namedChildren.find((child) => child.type === 'raw_text')?.text.trim() ?? '';
        const isInert = INERT_SCRIPT_TYPES.has(kind) || held.some((entry) => entry.name === 'src');
        return isInert || body === ''
            ? []
            : [
                  {
                      node: element,
                      rule: 'inline-script',
                      text: 'Move executable inline script to a script file.',
                  },
              ];
    });
    const handlers = root.descendantsOfType(['element', 'script_element']).flatMap((element) => {
        const held = attributes(element);
        const kind = held.find((entry) => entry.name === 'type')?.value.toLowerCase() ?? '';
        return held.flatMap((entry): MarkupProblem[] => {
            if (/^on[a-z]+$/u.test(entry.name))
                return [
                    {
                        node: entry.node,
                        rule: 'handler-attribute',
                        text: `The ${entry.name} attribute is inline script. Attach the handler from a script file.`,
                    },
                ];
            const scheme = scriptScheme(entry, kind);
            return scheme === undefined
                ? []
                : [
                      {
                          node: entry.node,
                          rule: 'script-link',
                          text: `A ${scheme} URL embeds executable content. Use an external file.`,
                      },
                  ];
        });
    });
    return [...inline, ...handlers];
}

// The text with the first placeholder of one kind cut out, or undefined when it holds none that closes.
function firstCut(text: string, open: string, close: string): string | undefined {
    const start = text.indexOf(open);
    const end = start === -1 ? -1 : text.indexOf(close, start + open.length);
    return end === -1 ? undefined : text.slice(0, start) + text.slice(end + close.length);
}

function withoutMarks(text: string, open: string, close: string): string {
    let rest = text;
    let cut = firstCut(rest, open, close);
    while (cut !== undefined) {
        rest = cut;
        cut = firstCut(rest, open, close);
    }
    return rest;
}

function copyProblems(root: Node): MarkupProblem[] {
    const texts = root
        .descendantsOfType('text')
        .filter((node) => LETTERS.test(withoutPlaceholders(node.text)))
        .map((node) => ({
            node,
            rule: 'literal-text',
            text: `The text "${node.text.trim().slice(0, SHOWN_TEXT)}" belongs in the content file, with a placeholder here.`,
        }));
    const held = root.descendantsOfType('element').flatMap((element) =>
        attributes(element)
            .filter((entry) => COPY_ATTRIBUTES.has(entry.name) && LETTERS.test(withoutPlaceholders(entry.value)))
            .map((entry) => ({
                node: entry.node,
                rule: 'literal-attribute',
                text: `The ${entry.name} attribute holds literal text. Use a placeholder.`,
            })),
    );
    return [...texts, ...held];
}

async function findings(
    input: EngineInput,
    paths: string[],
    read: (root: Node) => MarkupProblem[],
): Promise<Finding[]> {
    const found: Finding[] = [];
    for (const path of paths) {
        const tree = await parseSource(
            'html',
            readSource(input.root, path, input.observations).toString('utf8'),
            input,
        );
        if (tree === null) throw new Error('The source parser returned no tree.');
        try {
            for (const problem of read(tree.rootNode))
                found.push({
                    check: input.spec.name,
                    file: path,
                    line: problem.node.startPosition.row + 1,
                    column: problem.node.startPosition.column + 1,
                    rule: problem.rule,
                    message: problem.text,
                    fixable: false,
                });
        } finally {
            tree.delete();
        }
    }
    return found;
}

/**
 * Inline script, handler attributes and script links in every claimed HTML file.
 * @param input the engine input
 * @returns the findings
 */
export function htmlScripts(input: EngineInput): Promise<Finding[]> {
    const paths = input.files.filter((file) => file.nature === 'source').map((file) => file.path);
    return findings(input, paths, scriptProblems);
}

/**
 * Literal copy in the template files the policy names. With no template files the check passes.
 * @param input the engine input
 * @returns the findings
 */
export function htmlCopy(input: EngineInput): Finding[] | Promise<Finding[]> {
    const tool = input.view.tool('html');
    const templates = (tool['template_files'] as string[] | undefined) ?? [];
    if (templates.length === 0) return [];
    const excluded = ((tool['copy_allowed'] as { paths: string[] }[] | undefined) ?? []).flatMap(
        (entry) => entry.paths,
    );
    const isTemplate = pathMatcher(templates);
    const isExcluded = pathMatcher(excluded);
    const paths = input.files.map((file) => file.path).filter((path) => isTemplate(path) && !isExcluded(path));
    return findings(input, paths, copyProblems);
}
