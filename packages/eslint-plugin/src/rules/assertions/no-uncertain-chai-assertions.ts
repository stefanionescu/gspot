import { createRule } from '../../rule.ts';
import { listImportedModules } from '../../libraries/packages.ts';
import { UNCERTAIN_CHAI_PAIRS } from '../../config/assertions/styles.ts';
import type { ChainLink, UncertainPair } from '../../types/assertions.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listChainLinks(expression: TSESTree.Node): ChainLink[] {
    const links: ChainLink[] = [];
    let value = expression;
    let values: TSESTree.CallExpressionArgument[] | undefined;
    while (
        value.type === AST_NODE_TYPES.CallExpression ||
        (value.type === AST_NODE_TYPES.MemberExpression && !value.computed)
    ) {
        if (value.type === AST_NODE_TYPES.CallExpression) {
            values = value.arguments;
            value = value.callee;
            continue;
        }
        if (ASTUtils.isIdentifier(value.property)) links.unshift({ name: value.property, values });
        values = undefined;
        value = value.object;
    }
    if (ASTUtils.isIdentifier(value)) links.unshift({ name: value, values });
    return links;
}

function hasValues(link: ChainLink, pair: UncertainPair): boolean {
    const values = link.values ?? [];
    const isShape = values[0]?.type === AST_NODE_TYPES.ObjectExpression;
    return pair.minimum === 0 || (values.length >= pair.minimum && (isShape || !pair.needsShape));
}

function listUncertainPairs(links: ChainLink[]): Array<[ChainLink, ChainLink]> {
    const names = links.map(({ name }) => name.name);
    return UNCERTAIN_CHAI_PAIRS.flatMap((pair): Array<[ChainLink, ChainLink]> => {
        const start = names.indexOf(pair.first);
        const end = names.indexOf(pair.second);
        const [first, second] = [links[start], links[end]];
        const gap = links.slice(start + 1, end);
        const isNeighbor = end > start && gap.length <= 1 && gap.every(({ values }) => values === undefined);
        return first !== undefined && second !== undefined && isNeighbor && hasValues(second, pair)
            ? [[first, second]]
            : [];
    });
}

export const noUncertainChaiAssertions = createRule<[], 'uncertain'>({
    name: 'no-uncertain-chai-assertions',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a chai `expect` or `should` chain that can pass for more than one reason, in files that import chai: `.not.throw()` with an argument, `.not.include({...})`, `.not.property()` and `.not.ownPropertyDescriptor()` with a value, `.not.members()`, `.not.increase()`, `.not.decrease()`, `.not.by()`, `.not.finite`, and `.change().by()`.',
            why: 'A negated assertion with an argument also passes when the thing it names is missing for another reason. `.not.throw(TypeError)` passes when the code throws a different error.',
            fix: 'Assert the one result that the code must produce, such as `.not.throw()` without an argument or the exact value of a property.',
            example: '`expect(run).to.not.throw(TypeError);` reports `uncertain`. Write `expect(run).to.not.throw();`.',
        },
        schema: [],
        messages: { uncertain: 'Refactor this uncertain assertion; it can succeed for more than one reason.' },
    },
    create(context) {
        if (!listImportedModules(context.sourceCode).has('chai')) return {};
        return {
            ExpressionStatement({ expression }) {
                const links = listChainLinks(expression);
                const isAssertion =
                    links[0]?.name.name === 'expect' || links.some(({ name }) => name.name === 'should');
                const pairs = links.length > 1 && isAssertion ? listUncertainPairs(links) : [];
                for (const [first, second] of pairs)
                    context.report({
                        loc: { start: first.name.loc.start, end: second.name.loc.end },
                        messageId: 'uncertain',
                    });
            },
        };
    },
});
