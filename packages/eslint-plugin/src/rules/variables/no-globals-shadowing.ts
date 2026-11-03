import { createRule } from '../../rule.ts';
import { UNDEFINED_NAME } from '../../config/plugin.ts';
import type { FunctionNode } from '../../types/plugin.ts';
import type { NameSet, NamedNode } from '../../types/variables.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ARGUMENTS_NAME, BUILTIN_GLOBALS, SHADOWING_EXCEPTIONS } from '../../config/variables.ts';

function unwrapPattern(node: TSESTree.Node | null | undefined): TSESTree.Node | null | undefined {
    let pattern = node;
    while (pattern?.type === AST_NODE_TYPES.RestElement || pattern?.type === AST_NODE_TYPES.AssignmentPattern)
        pattern = pattern.type === AST_NODE_TYPES.RestElement ? pattern.argument : pattern.left;
    return pattern;
}

function listNames(node: TSESTree.Node | null | undefined): TSESTree.Identifier[] {
    const pattern = unwrapPattern(node);
    switch (pattern?.type) {
        case AST_NODE_TYPES.Identifier: {
            return [pattern];
        }
        case AST_NODE_TYPES.ArrayPattern: {
            return pattern.elements.flatMap((element) => listNames(element));
        }
        case AST_NODE_TYPES.ObjectPattern: {
            return pattern.properties.flatMap((property) =>
                listNames(property.type === AST_NODE_TYPES.Property ? property.value : property.argument),
            );
        }
        default: {
            return [];
        }
    }
}

function listFunctionNames(node: FunctionNode): NameSet[] {
    const names = node.params.flatMap((parameter) => listNames(parameter));
    const parameters: NameSet = { names, kind: 'parameter', unset: node.params };
    return [{ names: listNames(node.id), kind: 'function', unset: [] }, parameters];
}

function listVariableNames(node: TSESTree.VariableDeclarator): NameSet[] {
    const names = listNames(node.id);
    const unset = node.init === null ? [node.id] : [];
    return [{ names, kind: 'variable', unset }];
}

function listNameSets(node: NamedNode): NameSet[] {
    switch (node.type) {
        case AST_NODE_TYPES.FunctionDeclaration:
        case AST_NODE_TYPES.FunctionExpression:
        case AST_NODE_TYPES.ArrowFunctionExpression: {
            return listFunctionNames(node);
        }
        case AST_NODE_TYPES.VariableDeclarator: {
            return listVariableNames(node);
        }
        case AST_NODE_TYPES.CatchClause: {
            return [{ names: listNames(node.param), kind: 'variable', unset: [] }];
        }
        case AST_NODE_TYPES.AssignmentExpression: {
            return [{ names: listNames(node.left), kind: 'assignment', unset: [] }];
        }
        case AST_NODE_TYPES.UpdateExpression: {
            return [{ names: listNames(node.argument), kind: 'assignment', unset: [] }];
        }
    }
}

function isShadowing({ name, isUnset }: { name: string; isUnset: boolean }): boolean {
    if (SHADOWING_EXCEPTIONS.has(name)) return false;
    return name === UNDEFINED_NAME ? !isUnset : name === ARGUMENTS_NAME || BUILTIN_GLOBALS.has(name);
}

function listShadowingNames(node: NamedNode): Array<TSESLint.ReportDescriptor<'declaration' | 'assignment'>> {
    return listNameSets(node).flatMap(({ names, kind, unset }) =>
        names
            .filter((identifier) => isShadowing({ name: identifier.name, isUnset: unset.includes(identifier) }))
            .map((identifier) => ({
                node: identifier,
                messageId: kind === 'assignment' ? 'assignment' : 'declaration',
                data: { kind, name: identifier.name },
            })),
    );
}

export const noGlobalsShadowing = createRule<[], 'declaration' | 'assignment'>({
    name: 'no-globals-shadowing',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a variable, function, parameter, or catch binding named after a built-in global of JavaScript, such as `Object` or `parseInt`, and an assignment or update of one of these names.',
            why: 'A local name that hides a built-in makes the built-in unreachable in that scope, and readers expect the standard behavior.',
            fix: 'Rename the binding, or stop assigning to the built-in.',
            example:
                '`function parse(String) { return String.trim(); }` reports `declaration`. Name the parameter `text`.',
        },
        schema: [],
        messages: {
            declaration: 'Do not name this {{kind}} {{name}}. It hides a built-in. Choose another name.',
            assignment: 'Do not assign to {{name}}. It is a built-in.',
        },
    },
    create(context) {
        const inspect = (node: NamedNode) => {
            const issues = listShadowingNames(node);
            for (const issue of issues) context.report(issue);
        };
        return {
            FunctionDeclaration: inspect,
            FunctionExpression: inspect,
            ArrowFunctionExpression: inspect,
            VariableDeclarator: inspect,
            CatchClause: inspect,
            AssignmentExpression: inspect,
            UpdateExpression: inspect,
        };
    },
});
