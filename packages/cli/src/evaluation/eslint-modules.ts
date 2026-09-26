// The modules an ESLint configuration imports: each export is registered so a plugin, parser, or processor value
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { isAbsolute, relative } from 'node:path';
import { createRequire, isBuiltin } from 'node:module';
import type { PendingModule } from '#cli/types/evaluation.ts';
// found in the configuration can be named by module and export instead of serialized.
import type { EslintRegistration } from '#cli/types/policy/policy.ts';

// Whether a value can be named by its module: an object or a function.
function isRegistrable(value: unknown): value is object {
    if (value === null) return false;
    return typeof value === 'object' || typeof value === 'function';
}

// The members of an exported object, queued for registration under their export.
function memberEntries(value: object, exported: string, members: string[]): PendingModule[] {
    if (typeof value !== 'object') return [];
    const children: [string, unknown][] = Object.entries(value);
    return children.map(([member, child]) => ({ value: child, exported, members: [...members, member] }));
}

// Registers every reachable export of an imported module, preferring the default export for a value found twice.
function registerExports(
    imported: Record<string, unknown>,
    specifier: string,
    references: Map<unknown, EslintRegistration>,
): void {
    const pending: PendingModule[] = Object.entries(imported)
        .toSorted(([left], [right]) => Number(left === 'default') - Number(right === 'default'))
        .map(([key, value]) => ({ value, exported: key, members: [] }));
    for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
        const { value, exported, members } = entry;
        if (!isRegistrable(value) || references.has(value)) continue;
        references.set(value, { module: specifier, export: exported, ...(members.length === 0 ? {} : { members }) });
        pending.push(...memberEntries(value, exported, members));
    }
}

// The module a call imports: import('x') or require('x') with one literal argument.
function calledSpecifier(expression: ts.CallExpression): string | undefined {
    const [specifier] = expression.arguments;
    if (expression.arguments.length !== 1 || specifier === undefined || !ts.isStringLiteral(specifier))
        return undefined;
    const callee = expression.expression;
    const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
    const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
    return isImport || isRequire ? specifier.text : undefined;
}

// The module an expression imports, looking through await, parentheses, and property access.
function importedSpecifier(expression: ts.Expression): string | undefined {
    if (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression))
        return importedSpecifier(expression.expression);
    if (ts.isPropertyAccessExpression(expression)) return importedSpecifier(expression.expression);
    return ts.isCallExpression(expression) ? calledSpecifier(expression) : undefined;
}

// The expressions a statement may import from: initializers, the default export, and assignments.
function importingExpressions(statement: ts.Statement): ts.Expression[] {
    if (ts.isVariableStatement(statement))
        return statement.declarationList.declarations.flatMap((declaration) =>
            declaration.initializer === undefined ? [] : [declaration.initializer],
        );
    if (ts.isExportAssignment(statement)) return [statement.expression];
    const isAssignment =
        ts.isExpressionStatement(statement) &&
        ts.isBinaryExpression(statement.expression) &&
        statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken;
    return isAssignment ? [statement.expression.right] : [];
}

// The modules one statement imports: a static import, or the dynamic imports of its expressions.
function statementImports(statement: ts.Statement): string[] {
    if (ts.isImportDeclaration(statement))
        return ts.isStringLiteral(statement.moduleSpecifier) ? [statement.moduleSpecifier.text] : [];
    return importingExpressions(statement).flatMap((expression) => {
        const specifier = importedSpecifier(expression);
        return specifier === undefined ? [] : [specifier];
    });
}

/**
 * Registers a module and every value it exports, so configuration values can be named by their owner.
 * @param root the repository root
 * @param configPath the configuration the module is resolved from
 * @param name the module specifier or path as the configuration wrote it
 * @param references the registrations, extended here
 */
export async function registerEslintModule(
    root: string,
    configPath: string,
    name: string,
    references: Map<unknown, EslintRegistration>,
): Promise<void> {
    const resolved = createRequire(configPath).resolve(name);
    const specifier =
        name.startsWith('.') || isAbsolute(name) ? `./${relative(root, resolved).replaceAll('\\', '/')}` : name;
    if (specifier.startsWith('./../'))
        throw new Error(`ESLint conversion cannot register a module outside the repository: ${name}`);
    const imported = (await import(isBuiltin(resolved) ? resolved : pathToFileURL(resolved).href)) as Record<
        string,
        unknown
    >;
    references.set(imported, { module: specifier, export: '*' });
    registerExports(imported, specifier, references);
}

/**
 * The modules a flat configuration file imports, statically or through import() and require().
 * @param configPath the configuration file
 * @param text its source
 * @returns the specifiers, in first-seen order
 */
export function importedModules(configPath: string, text: string): Set<string> {
    const syntax = ts.createSourceFile(configPath, text, ts.ScriptTarget.Latest, true);
    const imports = new Set<string>();
    for (const statement of syntax.statements)
        for (const specifier of statementImports(statement)) imports.add(specifier);
    return imports;
}
