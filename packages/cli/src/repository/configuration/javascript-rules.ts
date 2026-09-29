import ts from 'typescript';

// CommonJS assignments require literal module.exports. Computed and compound access are rejected.
function commonjsExport(statement: ts.ExpressionStatement): ts.Expression | undefined {
    if (!ts.isBinaryExpression(statement.expression)) return undefined;
    const assignment = statement.expression;
    const target = assignment.left;
    if (
        assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(target) &&
        ts.isIdentifier(target.expression) &&
        target.expression.text === 'module' &&
        target.name.text === 'exports'
    )
        return assignment.right;
    return undefined;
}

// The values the keyword literals spell.
const KEYWORD_LITERALS = new Map<ts.SyntaxKind, unknown>([
    [ts.SyntaxKind.TrueKeyword, true],
    [ts.SyntaxKind.FalseKeyword, false],
    [ts.SyntaxKind.NullKeyword, null],
]);

// The scalar a literal spells: a string, a number, a boolean, or null. Anything else is code.
function scalarValue(node: ts.Expression): unknown {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node) || (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)))
        return Number(node.getText());
    if (KEYWORD_LITERALS.has(node.kind)) return KEYWORD_LITERALS.get(node.kind);
    throw new Error('JavaScript rule comparison requires literal keys and values.');
}

// The key a property spells: a plain identifier or a quoted string, never a computed name.
function propertyKey(property: ts.ObjectLiteralElementLike): string {
    if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))
        throw new Error('JavaScript rule comparison requires literal keys and values.');
    return ts.isStringLiteral(property.name) ? property.name.text : property.name.getText();
}

// The data a literal expression spells: objects and arrays of scalars, read without running any code.
function literalValue(node: ts.Expression): unknown {
    if (ts.isObjectLiteralExpression(node))
        return Object.fromEntries(
            node.properties.map((property) => [
                propertyKey(property),
                literalValue((property as ts.PropertyAssignment).initializer),
            ]),
        );
    if (ts.isArrayLiteralExpression(node)) return node.elements.map((element) => literalValue(element));
    return scalarValue(node);
}

/**
 * Read a single static JavaScript configuration export without executing any code.
 * @param path the file path, for diagnostics
 * @param text the file text
 * @returns the exported value as data
 */
export function javascriptRules(path: string, text: string): unknown {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const [statement] = source.statements;
    if (source.statements.length !== 1 || statement === undefined)
        throw new Error('JavaScript rule comparison requires a single static configuration export.');
    let expression: ts.Expression | undefined;
    if (ts.isExportAssignment(statement) && statement.isExportEquals !== true) expression = statement.expression;
    else if (ts.isExpressionStatement(statement)) expression = commonjsExport(statement);
    if (expression === undefined || !ts.isObjectLiteralExpression(expression))
        throw new Error('JavaScript rule comparison requires a static object export.');
    return literalValue(expression);
}
