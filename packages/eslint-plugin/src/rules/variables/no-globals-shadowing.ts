import { createRule } from '../../rule.ts';
import { UNDEFINED_NAME } from '../../config/plugin.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { NameSet, NamedNode, FunctionNode } from '../../types/rules.ts';
import { ARGUMENTS_NAME, BUILTIN_GLOBALS, SHADOWING_EXCEPTIONS } from '../../config/variables.ts';

function listNames(node: TSESTree.Node | null | undefined): TSESTree.Identifier[] {
    switch (node?.type) {
        case AST_NODE_TYPES.Identifier: {
            return [node];
        }
        case AST_NODE_TYPES.RestElement: {
            return listNames(node.argument);
        }
        case AST_NODE_TYPES.AssignmentPattern: {
            return listNames(node.left);
        }
        case AST_NODE_TYPES.ArrayPattern: {
            return node.elements.flatMap((element) => listNames(element));
        }
        case AST_NODE_TYPES.ObjectPattern: {
            return node.properties.flatMap((property) =>
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
    if (name === UNDEFINED_NAME) return !isUnset;
    return name === ARGUMENTS_NAME || BUILTIN_GLOBALS.has(name);
}

export const noGlobalsShadowing = createRule<[], 'declaration' | 'assignment'>({
    name: 'no-globals-shadowing',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a variable, function, parameter, or catch binding named after a built-in global of JavaScript, such as `Object`, `NaN`, or `parseInt`, or named `arguments`, and an assignment or update of one of these names. `undefined` is reported only where it gets a value. The names of `Object.prototype` members and `escape` and `unescape` pass.',
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
            for (const { names, kind, unset } of listNameSets(node)) {
                const messageId = kind === 'assignment' ? 'assignment' : 'declaration';
                for (const identifier of names) {
                    const { name } = identifier;
                    if (isShadowing({ name, isUnset: unset.includes(identifier) }))
                        context.report({ node: identifier, messageId, data: { kind, name } });
                }
            }
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
