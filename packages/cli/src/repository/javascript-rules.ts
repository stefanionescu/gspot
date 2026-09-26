import JSON5 from 'json5';
import ts from 'typescript';

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
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) expression = statement.expression;
    else if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)) {
        const assignment = statement.expression;
        const target = assignment.left;
        if (
            assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(target) &&
            ts.isIdentifier(target.expression) &&
            target.expression.text === 'module' &&
            target.name.text === 'exports'
        )
            expression = assignment.right;
    }
    if (expression === undefined || !ts.isObjectLiteralExpression(expression))
        throw new Error('JavaScript rule comparison requires a static object export.');
    return JSON5.parse(expression.getText(source));
}
