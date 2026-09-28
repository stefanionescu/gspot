import type { ImplementedFunction } from '#plugin/types/rules.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES, ASTUtils } from '@typescript-eslint/utils';
import { functionUsage, isCallbackValue } from '#plugin/function-references.ts';
import { COMPUTATION_NODES, EXECUTABLE_STATEMENTS, FUNCTIONS, TYPE_ONLY } from '#plugin/constants/plugin.ts';

// A captured argument fixes part of a shared call contract; the function's own parameters only forward it.
function isCapturedArgument(
    argument: TSESTree.CallExpression['arguments'][number],
    implementation: ImplementedFunction,
    source: TSESLint.SourceCode,
): boolean {
    if (argument.type !== AST_NODE_TYPES.Identifier) return false;
    const binding = ASTUtils.findVariable(source.getScope(argument), argument.name);
    return (
        binding?.defs.some(
            (definition) =>
                definition.name.range[0] < implementation.range[0] ||
                definition.name.range[1] > implementation.range[1],
        ) === true
    );
}

/**
 * Read syntax children through the parser visitor keys. Metadata and parent links are excluded.
 * @param node the parent node
 * @param visitorKeys the child keys for each node type
 * @returns the direct syntax children
 */
export function childNodes(
    node: TSESTree.Node,
    visitorKeys: Readonly<Record<string, readonly string[]>>,
): TSESTree.Node[] {
    return (visitorKeys[node.type] ?? []).flatMap((key) => {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) return child.filter((item: unknown) => item !== null) as TSESTree.Node[];
        return child !== null && typeof child === 'object' ? [child as TSESTree.Node] : [];
    });
}

/**
 * Count executable statements without entering nested functions or type declarations.
 * @param node the node to count under
 * @param visitorKeys the child keys of each node type, from the parser
 * @returns the count
 */
export function statementCount(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type) || ('declare' in node && node.declare)) return 0;
    if (FUNCTIONS.has(node.type)) return node.type === AST_NODE_TYPES.FunctionDeclaration ? 1 : 0;
    const own = EXECUTABLE_STATEMENTS.has(node.type) ? 1 : 0;
    return childNodes(node, visitorKeys).reduce((count, child) => count + statementCount(child, visitorKeys), own);
}

/**
 * Identify calculations, constructed values, and fixed call arguments without entering unused nested functions.
 * @param node the function implementation
 * @param source the parser source and lexical bindings
 * @returns whether sharing the body preserves computation or fixed arguments beyond a forwarding call
 */
export function hasComputation(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    const expressions: TSESTree.Node[] = [];
    const visit = (current: TSESTree.Node): void => {
        if (current.type === AST_NODE_TYPES.FunctionDeclaration || TYPE_ONLY.has(current.type)) return;
        if (
            current.type === AST_NODE_TYPES.FunctionExpression ||
            current.type === AST_NODE_TYPES.ArrowFunctionExpression
        ) {
            if (isCallbackValue(current)) visit(current.body);
            return;
        }
        expressions.push(current);
        for (const child of childNodes(current, source.visitorKeys)) visit(child);
    };
    visit(node.body);
    const calls = expressions.filter(
        (expression): expression is TSESTree.CallExpression | TSESTree.NewExpression =>
            expression.type === AST_NODE_TYPES.CallExpression || expression.type === AST_NODE_TYPES.NewExpression,
    );
    return (
        expressions.some(
            (expression) =>
                COMPUTATION_NODES.has(expression.type) ||
                (expression.type === AST_NODE_TYPES.TemplateLiteral && expression.expressions.length > 0),
        ) ||
        calls.length > 1 ||
        calls.some((call) =>
            call.arguments.some(
                (argument) => argument.type === AST_NODE_TYPES.Literal || isCapturedArgument(argument, node, source),
            ),
        )
    );
}

/**
 * Identify implementations whose computation is shared by distinct call sites.
 * @param node the function implementation
 * @param source the parser source and type services
 * @returns whether inlining duplicates a computation
 */
export function hasSharedComputation(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    return functionUsage(node, source).calls > 1 && hasComputation(node, source);
}

/**
 * Identify constructors whose parameters or assignments initialize instance state.
 * @param node the implemented function
 * @returns whether removing the constructor loses its instance initialization contract
 */
export function hasConstructorState(node: ImplementedFunction): boolean {
    if (node.parent.type !== AST_NODE_TYPES.MethodDefinition || node.parent.kind !== 'constructor') return false;
    if (node.params.some((parameter) => parameter.type === AST_NODE_TYPES.TSParameterProperty)) return true;
    if (node.body.type !== AST_NODE_TYPES.BlockStatement) return false;
    return node.body.body.some(
        (statement) =>
            statement.type === AST_NODE_TYPES.ExpressionStatement &&
            statement.expression.type === AST_NODE_TYPES.AssignmentExpression &&
            statement.expression.left.type === AST_NODE_TYPES.MemberExpression &&
            statement.expression.left.object.type === AST_NODE_TYPES.ThisExpression,
    );
}
