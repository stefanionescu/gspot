import ts from 'typescript';
import { parse } from 'postcss';
import { posix } from 'node:path';
import selectorParser from 'postcss-selector-parser';
import { typescriptProgram } from '#cli/parsers/typescript.ts';
import type { CssClass, Importer, CssImporterSource } from '#cli/types/parsers/css.ts';

// CSS module objects use default or namespace bindings. Type-only and named imports do not carry the object.
function moduleBinding(statement: ts.ImportDeclaration): ts.Identifier | undefined {
    const clause = statement.importClause;
    if (clause === undefined || clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return undefined;
    if (clause.name !== undefined) return clause.name;
    const bindings = clause.namedBindings;
    return bindings !== undefined && ts.isNamespaceImport(bindings) ? bindings.name : undefined;
}

// Resolve one source file against the selected stylesheets before grouping its lexical binding reads.
function sourceImporters(
    path: string,
    source: ts.SourceFile,
    checker: ts.TypeChecker,
    sheets: Set<string>,
): [string, Importer][] {
    return source.statements
        .filter((node) => ts.isImportDeclaration(node))
        .flatMap((statement): [string, Importer][] => {
            if (!ts.isStringLiteral(statement.moduleSpecifier)) return [];
            const specifier = statement.moduleSpecifier.text;
            if (!specifier.startsWith('.')) return [];
            const sheet = posix.normalize(posix.join(posix.dirname(path), specifier));
            if (!sheets.has(sheet)) return [];
            const binding = moduleBinding(statement);
            if (binding === undefined) return [];
            const symbol = checker.getSymbolAtLocation(binding);
            if (symbol === undefined) return [];
            return [[sheet, { path, ...bindingReads(checker, symbol, source) }]];
        });
}

// A computed expression may select any class. Literal property and destructuring keys name one class.
function classRead(key: ts.Node, source: ts.SourceFile): CssClass | undefined {
    if (!ts.isIdentifier(key) && !ts.isStringLiteral(key)) return undefined;
    const line = source.getLineAndCharacterOfPosition(key.getStart(source)).line + 1;
    return { name: key.text, line };
}

function propertyReads(
    node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
    checker: ts.TypeChecker,
    symbol: ts.Symbol,
    source: ts.SourceFile,
): Omit<Importer, 'path'> {
    if (!ts.isIdentifier(node.expression) || checker.getSymbolAtLocation(node.expression) !== symbol)
        return { classes: [], isDynamic: false };
    if (ts.isElementAccessExpression(node) && !ts.isStringLiteral(node.argumentExpression))
        return { classes: [], isDynamic: true };
    const key = ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression;
    const entry = classRead(key, source);
    return { classes: entry === undefined ? [] : [entry], isDynamic: entry === undefined };
}

function destructuredReads(
    node: ts.VariableDeclaration,
    checker: ts.TypeChecker,
    symbol: ts.Symbol,
    source: ts.SourceFile,
): Omit<Importer, 'path'> {
    if (!ts.isObjectBindingPattern(node.name) || node.initializer === undefined)
        return { classes: [], isDynamic: false };
    if (!ts.isIdentifier(node.initializer) || checker.getSymbolAtLocation(node.initializer) !== symbol)
        return { classes: [], isDynamic: false };
    const entries = node.name.elements.map((element) =>
        element.dotDotDotToken === undefined ? classRead(element.propertyName ?? element.name, source) : undefined,
    );
    return {
        classes: entries.filter((entry) => entry !== undefined),
        isDynamic: entries.includes(undefined),
    };
}

// Reads through a local that shadows the import binding do not count.
function bindingReads(checker: ts.TypeChecker, symbol: ts.Symbol, source: ts.SourceFile): Omit<Importer, 'path'> {
    const reads: Omit<Importer, 'path'>[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
            reads.push(propertyReads(node, checker, symbol, source));
        if (ts.isVariableDeclaration(node)) reads.push(destructuredReads(node, checker, symbol, source));
        ts.forEachChild(node, visit);
    };
    visit(source);
    return { classes: reads.flatMap((entry) => entry.classes), isDynamic: reads.some((entry) => entry.isDynamic) };
}

// The closest bare scope marker controls the following sibling selectors.
function precedingMode(node: selectorParser.Base<string | undefined>): string | undefined {
    let sibling = node.prev();
    while (sibling !== undefined) {
        if (sibling.type === 'pseudo' && sibling.nodes.length === 0 && [':global', ':local'].includes(sibling.value))
            return sibling.value;
        sibling = sibling.prev();
    }
    return undefined;
}

// Functional scope markers apply to descendants until an explicit local function takes ownership.
function isGlobalClass(node: selectorParser.ClassName): boolean {
    let current: selectorParser.Base<string | undefined> = node;
    while (current.parent !== undefined) {
        const parent = current.parent;
        const mode = parent.type === 'pseudo' ? parent.value : precedingMode(current);
        if (mode === ':global') return true;
        if (parent.type === 'pseudo' && mode === ':local') return false;
        current = parent;
    }
    return false;
}

/**
 * Resolve lexical CSS module reads from the selected source files.
 * @param code the selected source texts
 * @param sheets the selected stylesheet paths
 * @returns importers and their literal or computed class reads, by stylesheet
 */
export function moduleImporters(code: CssImporterSource[], sheets: Set<string>): Map<string, Importer[]> {
    const sources = new Map(
        code.map(({ path, text }) => [path, ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)]),
    );
    const program = typescriptProgram(sources);
    const checker = program.getTypeChecker();
    const importers = new Map<string, Importer[]>();
    for (const [path, source] of sources)
        for (const [sheet, importer] of sourceImporters(path, source, checker, sheets)) {
            const entries = importers.get(sheet) ?? [];
            entries.push(importer);
            importers.set(sheet, entries);
        }
    return importers;
}

/**
 * Read local stylesheet classes and their source lines, excluding global selectors.
 * @param text the stylesheet source
 * @param path the stylesheet path for parser diagnostics
 * @returns each local class with its first source line
 */
export function definedClasses(text: string, path: string): CssClass[] {
    const sheet = parse(text, { from: path });
    const found = new Map<string, CssClass>();
    sheet.walkRules((rule) => {
        const line = rule.source?.start?.line ?? 1;
        selectorParser()
            .astSync(rule.selector)
            .walkClasses((node) => {
                if (isGlobalClass(node) || found.has(node.value)) return;
                const selectorLine = node.source?.start?.line ?? 1;
                found.set(node.value, { name: node.value, line: line + selectorLine - 1 });
            });
    });
    return [...found.values()];
}
