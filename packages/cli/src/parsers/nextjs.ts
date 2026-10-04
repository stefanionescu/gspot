import ts from 'typescript';
import { typescriptNodes } from '#cli/parsers/typescript.ts';
import type { NextSettingsProblem } from '#cli/types/parsers/nextjs.ts';
import { SECRET_NAME, DISABLED_CHECKS } from '#cli/config/parsers/nextjs.ts';

// Names whose values are computed at runtime cannot establish a configuration option.
function propertyName(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
    if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) return name.expression.text;
    return undefined;
}

// Assertions and parentheses keep the literal's runtime value.
function literalValue(value: ts.Expression): ts.Expression {
    let expression = value;
    while (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isTypeAssertionExpression(expression) ||
        ts.isSatisfiesExpression(expression)
    )
        expression = expression.expression;
    return expression;
}

/**
 * Read literal options without treating comments, strings, or nested env values as property names.
 * @param path the configuration file name
 * @param text the source text
 * @returns disabled checks and likely secret keys with one-based source lines
 */
export function nextSettingsProblems(path: string, text: string): NextSettingsProblem[] {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    return typescriptNodes(source)
        .filter((node) => ts.isPropertyAssignment(node))
        .flatMap((node): NextSettingsProblem[] => {
            const name = propertyName(node.name);
            if (name === undefined) return [];
            const value = literalValue(node.initializer);
            if (DISABLED_CHECKS.has(name) && value.kind === ts.SyntaxKind.TrueKeyword)
                return [
                    {
                        name,
                        line: source.getLineAndCharacterOfPosition(node.name.getStart(source)).line + 1,
                        kind: 'checks-off',
                    },
                ];
            if (name !== 'env' || !ts.isObjectLiteralExpression(value)) return [];
            return value.properties
                .filter((property) => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
                .flatMap((property): NextSettingsProblem[] => {
                    const key = propertyName(property.name);
                    if (key === undefined || !SECRET_NAME.test(key)) return [];
                    return [
                        {
                            name: key,
                            line: source.getLineAndCharacterOfPosition(property.name.getStart(source)).line + 1,
                            kind: 'env-secret',
                        },
                    ];
                });
        });
}
