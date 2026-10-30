import type { ImportSource } from './types/plugin.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { IMPORT_SELECTOR, REQUIRE_SELECTOR, UNWRAPPABLE_NODES, IMPORT_EQUALS_SELECTOR } from './config/plugin.ts';

const isUnwrappable = ASTUtils.isNodeOfTypes(UNWRAPPABLE_NODES.map((type) => AST_NODE_TYPES[type]));

function unwrap(node: TSESTree.Node | null): TSESTree.Node | null {
    let value = node;
    while (value !== null && isUnwrappable(value)) value = value.expression;
    return value;
}

function getOutermostMember(node: TSESTree.Node): TSESTree.Node {
    let outer = node;
    while (outer.parent?.type === AST_NODE_TYPES.MemberExpression && outer.parent.object === outer)
        outer = outer.parent;
    return outer;
}

function isMemberWrite(member: TSESTree.Node): boolean {
    const { parent } = member;
    if (member.type !== AST_NODE_TYPES.MemberExpression || parent === undefined) return false;
    return (
        (parent.type === AST_NODE_TYPES.AssignmentExpression && parent.left === member) ||
        parent.type === AST_NODE_TYPES.UpdateExpression ||
        (parent.type === AST_NODE_TYPES.UnaryExpression && parent.operator === 'delete')
    );
}

/**
Identify a direct alias of a value bound in this module.

@param node the expression assigned to another name
@param scope the expression's lexical scope
*/
export function isAlias(node: TSESTree.Node | null, scope: TSESLint.Scope.Scope): boolean {
    let value = unwrap(node);
    while (value?.type === AST_NODE_TYPES.MemberExpression && !value.computed) value = unwrap(value.object);
    if (value?.type !== AST_NODE_TYPES.Identifier) return false;
    const variable = ASTUtils.findVariable(scope, value);
    return (
        variable !== null &&
        variable.defs.length > 0 &&
        !variable.references.some(
            (reference) =>
                (reference.isWrite() && reference.init !== true) ||
                isMemberWrite(getOutermostMember(reference.identifier)),
        )
    );
}

/**
Build the visitors that hand each module specifier of a file to one check: imports, re-exports, dynamic and type imports, import-equals declarations, and CommonJS require calls.

@param checkSource the check that receives each specifier node.
@returns the visitors of the rule.
*/
export function buildSourceVisitors(checkSource: (source: TSESTree.Node) => void): TSESLint.RuleListener {
    return {
        [IMPORT_SELECTOR]: ({ source }: ImportSource) => {
            if (source !== null) checkSource(source);
        },
        [IMPORT_EQUALS_SELECTOR]: ({ expression }: TSESTree.TSExternalModuleReference) => {
            checkSource(expression);
        },
        [REQUIRE_SELECTOR]: ({ arguments: [argument] }: TSESTree.CallExpression) => {
            if (argument !== undefined) checkSource(argument);
        },
    };
}
