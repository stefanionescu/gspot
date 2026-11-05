import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

import type { CheckedType, TypeCategory, TypeReader } from '../types/plugin.ts';

/**
Get the TypeScript types of a file that the parser checked with a program. Files without type information get none.

@param context the rule context of the file.
*/
export function getTypes(context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>): TypeReader | undefined {
    const services = context.sourceCode.parserServices;
    const program = services?.program;
    const map = services?.esTreeNodeToTSNodeMap;
    if (program === undefined || program === null || map === undefined) return undefined;
    const checker = program.getTypeChecker();
    return { program, checker, map, get: (node) => checker.getTypeAtLocation(map.get(node)) };
}

/**
Identify a value whose type has a callable `then`, such as a promise.

@param types the type checker of the file.
@param node the expression to test.
*/
export function isThenable(types: TypeReader, node: TSESTree.Node): boolean {
    const type = types.get(node);
    const then = type.getProperty('then');
    return then !== undefined && types.checker.getTypeOfSymbol(then).getCallSignatures().length > 0;
}

/**
Sort a type into the category that a rule tests. Literal types and their unions count with their base type, and
`any` and `never` count as other, because they fit every category.

@param types the type checker of the file.
@param type the type to sort.
*/
export function getTypeCategory(types: TypeReader, type: CheckedType): TypeCategory {
    const { checker } = types;
    if (checker.isArrayType(type)) return 'array';
    const isString = checker.isTypeAssignableTo(type, checker.getStringType());
    const isNumber = checker.isTypeAssignableTo(type, checker.getNumberType());
    if (isString && isNumber) return 'other';
    if (isString) return 'string';
    if (isNumber || checker.isTypeAssignableTo(type, checker.getBigIntType())) return 'number';
    return checker.isTypeAssignableTo(type, checker.getBooleanType()) ? 'boolean' : 'other';
}
