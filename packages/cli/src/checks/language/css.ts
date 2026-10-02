import ts from 'typescript';
import { parse } from 'postcss';
import { posix } from 'node:path';
import selectorParser from 'postcss-selector-parser';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import type { Finding, Importer, EngineInput } from '#cli/types/checks.ts';
import { CODE_SUFFIX, MODULE_SUFFIX } from '#cli/config/checks/repository.ts';

// CSS module objects use default or namespace bindings. Type-only and named imports do not carry the object.
function moduleBinding(statement: ts.ImportDeclaration): ts.Identifier | undefined {
    const clause = statement.importClause;
    if (clause === undefined || clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return undefined;
    if (clause.name !== undefined) return clause.name;
    const bindings = clause.namedBindings;
    return bindings !== undefined && ts.isNamespaceImport(bindings) ? bindings.name : undefined;
}

// Bind identifiers without reading dependencies or sources outside the selected inventory.
function moduleImporters(code: { path: string; text: string }[], sheets: Set<string>): Map<string, Importer[]> {
    const sources = new Map(
        code.map(({ path, text }) => [path, ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)]),
    );
    const options: ts.CompilerOptions = { noLib: true, noResolve: true, allowJs: true };
    const host: ts.CompilerHost = {
        getSourceFile: (path) => sources.get(path),
        getDefaultLibFileName: () => '',
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getDirectories: () => [],
        fileExists: (path) => sources.has(path),
        readFile: (path) => sources.get(path)?.text,
        getCanonicalFileName: (path) => path,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
    };
    const program = ts.createProgram([...sources.keys()], options, host);
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
            return [[sheet, { path, read: [...bindingReads(checker, symbol, source)] }]];
        });
}

// The properties read through one imported binding, including where lexical shadowing hides the name.
function bindingReads(checker: ts.TypeChecker, symbol: ts.Symbol, source: ts.Node): Set<string> {
    const reads = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (
            (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
            ts.isIdentifier(node.expression) &&
            checker.getSymbolAtLocation(node.expression) === symbol
        ) {
            if (ts.isPropertyAccessExpression(node)) reads.add(node.name.text);
            else if (ts.isStringLiteral(node.argumentExpression)) reads.add(node.argumentExpression.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return reads;
}

function sheetFindings(input: EngineInput, sheet: string, defined: string[], importers: Importer[]): Finding[] {
    const name = sheet.slice(sheet.lastIndexOf('/') + 1);
    if (importers.length === 0) return [];
    const known = new Set(
        defined.flatMap((entry) => [
            entry,
            entry.replaceAll(/-(?<letter>[a-z\d])/gu, (_match, letter: string) => letter.toUpperCase()),
        ]),
    );
    const read = new Set(importers.flatMap((file) => file.read));
    const unused = defined
        .filter(
            (entry) =>
                !read.has(entry) &&
                !read.has(entry.replaceAll(/-(?<letter>[a-z\d])/gu, (_match, letter: string) => letter.toUpperCase())),
        )
        .map((entry) =>
            findingAt(input, { file: sheet, line: 1 }, 'unused-class', `No importer reads the class ${entry}.`),
        );
    const missing = importers.flatMap((file) =>
        file.read
            .filter((entry) => !known.has(entry))
            .map((entry) =>
                findingAt(input, { file: file.path, line: 1 }, 'undefined-class', `${name} defines no class ${entry}.`),
            ),
    );
    return [...unused, ...missing];
}

function definedClasses(text: string, path: string): string[] {
    const sheet = parse(text, { from: path });
    const found = new Set<string>();
    sheet.walkRules((rule) => {
        selectorParser()
            .astSync(rule.selector)
            .walkClasses((node) => {
                found.add(node.value);
            });
    });
    return [...found];
}

/**
 * The findings of every CSS module of the scope.
 * @param input the engine input
 * @returns the findings
 */
export function cssModuleUsage(input: EngineInput): Finding[] {
    const paths = input.files.filter((file) => file.kind === 'source').map((file) => file.path);
    const code = paths
        .filter((path) => CODE_SUFFIX.test(path))
        .map((path) => ({ path, text: readSource(input.root, path, input.reads).toString('utf8') }));
    const findings: Finding[] = [];
    const sheets = paths.filter((path) => MODULE_SUFFIX.test(path));
    const importers = moduleImporters(code, new Set(sheets));
    for (const sheet of sheets) {
        const defined = definedClasses(readSource(input.root, sheet, input.reads).toString('utf8'), sheet);
        findings.push(...sheetFindings(input, sheet, defined, importers.get(sheet) ?? []));
    }
    return findings;
}
