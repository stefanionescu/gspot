import ts from 'typescript';
import { findingAt } from '#cli/checks/finding.ts';
import { globPaths } from '#cli/platform/paths.ts';
import { join, dirname, basename } from 'node:path';
import { readSource } from '#cli/platform/source.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { typescriptNodes } from '#cli/parsers/typescript.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';

function generatedContents(cwd: string): Map<string, Buffer> {
    const paths = globPaths(cwd, ['**/*', '!**/node_modules/**', '!**/.venv/**', '!**/.gspot/**'], { dot: true });
    return new Map(paths.map((path) => [path, readSource(cwd, path)]));
}

/**
 * One finding for each table that references another and has no relations entry anywhere in the scope.
 * @param input the engine input
 * @returns the findings
 */
export function relations(input: EngineInput): Finding[] {
    const files = input.files
        .filter((file) => file.kind === 'source' && /\.tsx?$/u.test(file.path))
        .map((file) => ({
            path: file.path,
            source: ts.createSourceFile(
                file.path,
                readSource(input.root, file.path, input.reads).toString('utf8'),
                ts.ScriptTarget.Latest,
                true,
            ),
        }));
    const calls = files.flatMap((file) => typescriptNodes(file.source).filter((node) => ts.isCallExpression(node)));
    const declared = new Set(
        calls.flatMap((call) => {
            if (!ts.isIdentifier(call.expression) || call.expression.text !== 'relations') return [];
            const table = call.arguments[0];
            return table !== undefined && ts.isIdentifier(table) ? [table.text] : [];
        }),
    );
    const variables = files.flatMap((file) =>
        typescriptNodes(file.source)
            .filter((node) => ts.isVariableDeclaration(node))
            .map((node) => ({ file, node })),
    );
    const tables = variables.flatMap(({ file, node }) => {
        const { name, initializer } = node;
        if (!ts.isIdentifier(name) || initializer === undefined || !ts.isCallExpression(initializer)) return [];
        const expression = initializer.expression;
        const isTable = ts.isIdentifier(expression)
            ? /^(?:pg|mysql|sqlite)Table$/u.test(expression.text)
            : ts.isPropertyAccessExpression(expression) && expression.name.text === 'table';
        if (!isTable) return [];
        const referenced = typescriptNodes(initializer)
            .filter((node) => ts.isCallExpression(node))
            .some(
                (call) => ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'references',
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

/**
 * Generates migrations in an isolated copy and reports changed output.
 * @param input the engine input
 * @returns the findings
 */
export async function migrations(input: EngineInput): Promise<Finding[]> {
    if (
        !input.files.some(
            (file) => dirname(file.path) === (input.scope || '.') && basename(file.path).startsWith('drizzle.config.'),
        )
    )
        return [];
    using scratchFolder = await copyIntoScratch(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const scratch = scratchFolder.path;
    const isolated = join(scratch, input.scope);
    const before = generatedContents(isolated);
    const result = await runEngineTool(input, ['drizzle-kit', 'generate'], { cwd: isolated });
    if (result.code !== 0)
        throw new Error(
            `The drizzle-kit generate command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    const after = generatedContents(isolated);
    const changed = [...new Set([...before.keys(), ...after.keys()])]
        .filter((path) => {
            const was = before.get(path);
            const now = after.get(path);
            return was === undefined || now === undefined || !was.equals(now);
        })
        .toSorted((left, right) => left.localeCompare(right));
    return changed.map((path) =>
        findingAt(
            input,
            { file: input.scope === '' ? path : `${input.scope}/${path}`, line: 1 },
            'stale',
            'drizzle-kit changes this file when generating migrations; regenerate and commit the migration output.',
        ),
    );
}
