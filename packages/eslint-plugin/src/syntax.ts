import { DRIVE_LETTER, UNWRAPPABLE_NODES } from './config/syntax.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

const isUnwrappable = ASTUtils.isNodeOfTypes(UNWRAPPABLE_NODES.map((type) => AST_NODE_TYPES[type]));

function unwrap(node: TSESTree.Node | null): TSESTree.Node | null {
    let value = node;
    while (value !== null && isUnwrappable(value)) value = value.expression;
    return value;
}

/**
Identify a direct alias of a value bound in this module.

@param node the expression assigned to another name
@param scope the expression's lexical scope
@returns whether the expression only selects a bound value
*/
export function isAlias(node: TSESTree.Node | null, scope: TSESLint.Scope.Scope): boolean {
    let value = unwrap(node);
    while (value?.type === AST_NODE_TYPES.MemberExpression && !value.computed) value = unwrap(value.object);
    return value?.type === AST_NODE_TYPES.Identifier && (ASTUtils.findVariable(scope, value)?.defs.length ?? 0) > 0;
}

/**
Normalize separators and drive casing before comparing repository paths.

@param path the operating system path
@returns the comparable POSIX path
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function convertToPosixPath(path: string): string {
    return path.replaceAll('\\', '/').replace(DRIVE_LETTER, (drive) => drive.toUpperCase());
}
