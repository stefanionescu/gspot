import { type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { DEFAULT_IDENTICAL_LINES, IDENTICAL_FUNCTIONS_OPTIONS_SCHEMA } from '../../config/functions.ts';
import { haveSameTokens } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';

function countBodyLines(body: TSESTree.Node, source: TSESLint.SourceCode): number {
    const tokens = source.getTokens(body);
    const inner = tokens.slice(tokens.at(0)?.value === '{' ? 1 : 0, tokens.at(-1)?.value === '}' ? -1 : tokens.length);
    const [first] = inner;
    const last = inner.at(-1);
    return first === undefined || last === undefined ? 0 : last.loc.end.line - first.loc.start.line + 1;
}

export const noIdenticalFunctions = createRule<[{ minLines: number }], 'identical'>({
    name: 'no-identical-functions',
    meta: {
        defaultOptions: [{ minLines: DEFAULT_IDENTICAL_LINES }],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a function declaration, method, or function assigned to a variable whose body has the same tokens as an earlier one of the file, when the body spans `minLines` lines or more, three by default.',
            why: 'Two copies of one implementation drift apart when only one of them gets a fix.',
            fix: 'Keep one function and call it from both places, or make the second one differ for a reason.',
            example: 'Two functions whose three-line bodies are the same report `identical` at the second.',
        },
        schema: [IDENTICAL_FUNCTIONS_OPTIONS_SCHEMA],
        messages: { identical: 'This function repeats the function on line {{line}}. Call that one instead.' },
    },
    create(context, [{ minLines }]) {
        const source = context.sourceCode;
        const seen: FunctionNode[] = [];
        const inspect = (node: FunctionNode) => {
            if (countBodyLines(node.body, source) < minLines) return;
            const first = seen.find((earlier) => haveSameTokens(earlier.body, node.body, source));
            seen.push(node);
            if (first !== undefined)
                context.report({ node, messageId: 'identical', data: { line: first.loc.start.line } });
        };
        return {
            FunctionDeclaration: inspect,
            ':matches(VariableDeclarator, MethodDefinition) > :matches(FunctionExpression, ArrowFunctionExpression)':
                inspect,
        };
    },
});
