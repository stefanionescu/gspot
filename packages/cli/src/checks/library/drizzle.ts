import ts from 'typescript';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/system/file-reads.ts';
import { typescriptNodes } from '#cli/parsers/typescript.ts';
import { TYPESCRIPT_SOURCE } from '#cli/config/checks/library.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

/**
 * One finding for each table that references another and has no relations entry anywhere in the scope.
 * @param input the check input.
 * @returns the findings.
 */
export function drizzleRelations(input: CheckInput): Finding[] {
    const files = input.files
        .filter((file) => file.kind === 'source' && TYPESCRIPT_SOURCE.test(file.path))
        .map(({ path }) => {
            const text = readSource(input.root, path, input.reads).toString('utf8');
            const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
            return { path, source, nodes: typescriptNodes(source) };
        });
    const calls = files.flatMap((file) => file.nodes.filter((node) => ts.isCallExpression(node)));
    const declared = new Set(
        calls.flatMap((call) => {
            const table = call.arguments[0];
            if (!ts.isIdentifier(call.expression) || table === undefined) return [];
            if (call.expression.text === 'relations') return ts.isIdentifier(table) ? [table.text] : [];
            if (call.expression.text !== 'defineRelations' || !ts.isObjectLiteralExpression(table)) return [];
            return table.properties.flatMap((property) => {
                if (ts.isShorthandPropertyAssignment(property)) return [property.name.text];
                return ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)
                    ? [property.initializer.text]
                    : [];
            });
        }),
    );
    const variables = files.flatMap((file) =>
        file.nodes.filter((node) => ts.isVariableDeclaration(node)).map((node) => ({ file, node })),
    );
    const tables = variables.flatMap(({ file, node }) => {
        const { name, initializer } = node;
        if (!ts.isIdentifier(name) || initializer === undefined || !ts.isCallExpression(initializer)) return [];
        const expression = initializer.expression;
        const isTable = ts.isIdentifier(expression)
            ? /^(?:pg|mysql|sqlite)Table$/u.test(expression.text)
            : ts.isPropertyAccessExpression(expression) && expression.name.text === 'table';
        if (!isTable) return [];
        const referenced = typescriptNodes(initializer).some(
            (node) =>
                ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'references',
        );
        if (!referenced) return [];
        return [
            {
                path: file.path,
                line: file.source.getLineAndCharacterOfPosition(node.getStart(file.source)).line + 1,
                name: name.text,
            },
        ];
    });
    return tables
        .filter((table) => !declared.has(table.name))
        .map((table) =>
            findingAt(
                input,
                { file: table.path, line: table.line },
                'relations',
                `${table.name} references another table and has no relations entry.`,
            ),
        );
}
