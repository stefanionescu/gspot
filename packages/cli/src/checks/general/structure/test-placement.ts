import ts from 'typescript';
import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/root/public.ts';
import { rolePaths } from '#cli/policy/settings/contracts.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { isInScope, pathMatcher } from '#cli/repository/paths/public.ts';
import { structureSources } from '#cli/checks/general/structure/source-files.ts';
import { typescriptNodes, typescriptProgram } from '#cli/parsers/source/contracts.ts';
import { TEST_PATTERN, TEST_DIRECTORIES, ASSERTION_MODULES } from '#cli/config/checks/general/structure.ts';

function hasAssertions(source: ts.SourceFile, checker: ts.TypeChecker): boolean {
    const bindings = source.statements.flatMap((statement) => {
        if (
            !ts.isImportDeclaration(statement) ||
            !ts.isStringLiteral(statement.moduleSpecifier) ||
            !ASSERTION_MODULES.has(statement.moduleSpecifier.text)
        )
            return [];
        const named = statement.importClause?.namedBindings;
        return named !== undefined && ts.isNamedImports(named)
            ? named.elements.filter((entry) => (entry.propertyName ?? entry.name).text === 'expect')
            : [];
    });
    const symbols = new Set(
        bindings.map((binding) => checker.getSymbolAtLocation(binding.name)).filter((symbol) => symbol !== undefined),
    );
    return typescriptNodes(source).some((node) => {
        if (
            !ts.isCallExpression(node) ||
            !ts.isIdentifier(node.expression) ||
            (!ts.isPropertyAccessExpression(node.parent) && !ts.isElementAccessExpression(node.parent))
        )
            return false;
        const symbol = checker.getSymbolAtLocation(node.expression);
        return symbol !== undefined && symbols.has(symbol);
    });
}

/**
 * Place support beside its declared harness while accepting native test names and assertion modules.
 * @param input the scope-owned source inventory and effective architecture roles
 * @returns misplaced support files, without reading directories outside the inventory
 */
export const testPlacement: BuiltInCheck = (input) => {
    const harnesses = rolePaths(input.view.roles, 'test_harness').map((path) => path.replace(/\/(?:\*\*)?$/u, ''));
    const harness = harnesses[0];
    if (harness === undefined) return [];
    const files = structureSources(input).filter(
        (file) => file.tags.includes('javascript') || file.tags.includes('typescript'),
    );
    const folders = new Set(
        files.filter((file) => TEST_PATTERN.test(posix.basename(file.path))).map((file) => posix.dirname(file.path)),
    );
    const isTestFolder = pathMatcher(TEST_DIRECTORIES);
    const sources = new Map(
        files
            .filter(
                (file) =>
                    !TEST_PATTERN.test(posix.basename(file.path)) &&
                    isTestFolder(file.path) &&
                    folders.has(posix.dirname(file.path)) &&
                    !harnesses.some((folder) => isInScope(file.path, folder)),
            )
            .map((file) => [
                file.path,
                ts.createSourceFile(
                    file.path,
                    readSource(input.root, file.path, input.reads).toString('utf8'),
                    ts.ScriptTarget.Latest,
                    true,
                ),
            ]),
    );
    const checker = typescriptProgram(sources).getTypeChecker();
    return [...sources].flatMap(([path, source]) =>
        source.isDeclarationFile || hasAssertions(source, checker)
            ? []
            : [
                  findingAt(
                      input,
                      { file: path, line: 1 },
                      'misplaced',
                      `${posix.basename(path)} is not a test but sits beside tests. Move it to ${harness}.`,
                  ),
              ],
    );
};
