import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { haveSameTokens } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';
import type { Branch, BranchSet } from '../../types/control-flow.ts';

function isMultiline(statements: readonly TSESTree.Node[], source: TSESLint.SourceCode): boolean {
    const tokens = statements
        .flatMap((node) => source.getTokens(node))
        .filter((token) => token.value !== '{' && token.value !== '}');
    const [first] = tokens;
    const last = tokens.at(-1);
    return first !== undefined && last !== undefined && last.loc.end.line > first.loc.start.line;
}

function listIfBranches(node: TSESTree.IfStatement): BranchSet {
    const branches: Branch[] = [{ node: node.consequent, body: [node.consequent] }];
    let next = node.alternate;
    for (; next?.type === AST_NODE_TYPES.IfStatement; next = next.alternate)
        branches.push({ node: next.consequent, body: [next.consequent] });
    if (next !== null) branches.push({ node: next, body: [next] });
    return { owner: node, kind: 'branch', branches, closing: next === null ? 'none' : 'filled' };
}

function listSwitchBranches(node: TSESTree.SwitchStatement): BranchSet {
    const branches = node.cases.flatMap((clause): Branch[] => {
        const [first] = clause.consequent;
        const statements =
            clause.consequent.length === 1 && first?.type === AST_NODE_TYPES.BlockStatement
                ? first.body
                : clause.consequent;
        const body = statements.at(-1)?.type === AST_NODE_TYPES.BreakStatement ? statements.slice(0, -1) : statements;
        return body.length > 0 ? [{ node: clause, body }] : [];
    });
    if (node.cases.every((clause) => clause.test !== null))
        return { owner: node, kind: 'case', branches, closing: 'none' };
    const isFilled = branches.at(-1)?.node === node.cases.at(-1);
    return { owner: node, kind: 'case', branches, closing: isFilled ? 'filled' : 'empty' };
}

function isUniform(branches: readonly Branch[], source: TSESLint.SourceCode): boolean {
    const [first, ...rest] = branches;
    return first !== undefined && rest.length > 0 && rest.every(({ body }) => haveSameTokens(body, first.body, source));
}

function listRepeats(
    { branches, isChain }: { branches: readonly Branch[]; isChain: boolean },
    source: TSESLint.SourceCode,
): Array<{ branch: Branch; first: Branch }> {
    return branches.flatMap((branch, index) => {
        if (index === 0 || (!isChain && !isMultiline(branch.body, source))) return [];
        const first = isChain
            ? branches[index - 1]
            : branches.slice(0, index).find((earlier) => haveSameTokens(branch.body, earlier.body, source));
        return first === undefined ? [] : [{ branch, first }];
    });
}

function listBranchIssues(
    node: TSESTree.IfStatement | TSESTree.SwitchStatement,
    source: TSESLint.SourceCode,
): Array<TSESLint.ReportDescriptor<'branch' | 'all'>> {
    const isIf = node.type === AST_NODE_TYPES.IfStatement;
    if (isIf && node.parent.type === AST_NODE_TYPES.IfStatement) return [];
    const { owner, kind, branches, closing } = isIf ? listIfBranches(node) : listSwitchBranches(node);
    const isSame = isUniform(branches, source);
    if (isSame && closing === 'filled') return [{ node: owner, messageId: 'all', data: { kind } }];
    return listRepeats({ branches, isChain: isSame && closing === 'none' }, source).map(({ branch, first }) => ({
        node: branch.node,
        messageId: 'branch',
        data: { kind, line: first.node.loc.start.line },
    }));
}

export const noDuplicatedBranches = createRule<[], 'branch' | 'all' | 'ternary'>({
    name: 'no-duplicated-branches',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a branch of an `if` chain or `switch` that repeats an earlier branch, a chain whose branches all do the same, and a conditional expression whose two results are the same.',
            why: 'Two branches with the same code usually mean that one branch was copied and not changed, or that the condition does nothing.',
            fix: 'Change the branch that should differ. When the branches really do the same, merge their conditions, or remove the condition.',
            example:
                '`if (isAdmin) { grant(user); } else { grant(user); }` reports `all`. Write `grant(user);` without the condition.',
        },
        schema: [],
        messages: {
            branch: 'This {{kind}} repeats the {{kind}} on line {{line}}. Change it or merge the two.',
            all: 'Every {{kind}} does the same. Remove the condition, or change the {{kind}} that should differ.',
            ternary: 'This conditional expression gives the same value either way. Remove the condition.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'IfStatement, SwitchStatement': function (node: TSESTree.IfStatement | TSESTree.SwitchStatement) {
                for (const issue of listBranchIssues(node, source)) context.report(issue);
            },
            ConditionalExpression(node) {
                if (!haveSameTokens(node.consequent, node.alternate, source)) return;
                context.report({ node, messageId: 'ternary' });
            },
        };
    },
});
