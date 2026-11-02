import { createRule } from '../rule.ts';
import { buildRegexVisitors } from '../regex.ts';
import type { AST } from '@eslint-community/regexpp';
import { ANCHOR_PAIR, ANCHOR_KINDS } from '../config/regex.ts';

function getAnchors({ elements }: AST.Alternative): { start: boolean; end: boolean } {
    const [first] = elements;
    const last = elements.at(-1);
    return {
        start: first?.type === 'Assertion' && ANCHOR_KINDS.has(first.kind),
        end: last?.type === 'Assertion' && ANCHOR_KINDS.has(last.kind),
    };
}

function isOuterAnchorOnly(anchors: readonly { start: boolean; end: boolean }[]): boolean {
    const [first] = anchors;
    const last = anchors.at(-1);
    if (first === undefined || last === undefined || first.end || last.start) return false;
    return (first.start || last.end) && anchors.slice(1, -1).every(({ start, end }) => !start && !end);
}

function isAmbiguous({ alternatives }: AST.Pattern): boolean {
    const anchors = alternatives.map((alternative) => getAnchors(alternative));
    const isTrimPair = anchors.length === ANCHOR_PAIR && anchors[0]?.start === true && anchors[1]?.end === true;
    return anchors.length >= ANCHOR_PAIR && !isTrimPair && isOuterAnchorOnly(anchors);
}

export const noAmbiguousAnchors = createRule<[], 'anchors'>({
    name: 'no-ambiguous-anchors',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a regular expression whose top-level alternatives start with `^` only in the first alternative or end with `$` only in the last, such as `/^a|b|c$/`. The pair `/^\\s+|\\s+$/` for trimming passes.',
            why: 'An anchor binds only to its own alternative, so `/^a|b$/` means `^a` or `b$`, not `^(a|b)$`.',
            fix: 'Group the alternatives, such as `/^(?:a|b)$/`, or anchor each alternative on purpose.',
            example: '`/^error|warning$/` reports `anchors`. Write `/^(?:error|warning)$/`.',
        },
        schema: [],
        messages: { anchors: 'Group the alternatives of this pattern so that its anchors apply to all of them.' },
    },
    create(context) {
        return buildRegexVisitors((node, regex) => {
            if (isAmbiguous(regex.pattern)) context.report({ node, messageId: 'anchors' });
        }, context.sourceCode);
    },
});
