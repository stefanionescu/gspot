import ts from 'typescript';
import { parse } from 'postcss';
import { posix } from 'node:path';
import selectorParser from 'postcss-selector-parser';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';

const MODULE_SUFFIX = /\.module\.css$/u;
const CODE_SUFFIX = /\.(?:tsx?|jsx?|mjs)$/u;

type Importer = { path: string; read: string[] };

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
    for (const [path, source] of sources) {
        for (const statement of source.statements) {
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
            const specifier = statement.moduleSpecifier.text;
            if (!specifier.startsWith('.')) continue;
            const sheet = posix.normalize(posix.join(posix.dirname(path), specifier));
            if (!sheets.has(sheet)) continue;
            const clause = statement.importClause;
            if (clause === undefined || clause.phaseModifier === ts.SyntaxKind.TypeKeyword) continue;
            const binding =
                clause.name ??
                (clause.namedBindings !== undefined && ts.isNamespaceImport(clause.namedBindings)
                    ? clause.namedBindings.name
                    : undefined);
            if (binding === undefined) continue;
            const symbol = checker.getSymbolAtLocation(binding);
            if (symbol === undefined) continue;
            const reads = new Set<string>();
            const entries = importers.get(sheet) ?? [];
            const importer: Importer = { path, read: [] };
            entries.push(importer);
            importers.set(sheet, entries);
            // Each imported binding owns its uses, including lexical shadowing.
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
            importer.read = [...reads];
        }
    }
    return importers;
}

function camel(name: string): string {
    return name.replaceAll(/-(?<letter>[a-z\d])/gu, (_match, letter: string) => letter.toUpperCase());
}

function sheetFindings(input: EngineInput, sheet: string, defined: string[], importers: Importer[]): Finding[] {
    const name = sheet.slice(sheet.lastIndexOf('/') + 1);
    if (importers.length === 0) return [];
    const known = new Set(defined.flatMap((entry) => [entry, camel(entry)]));
    const read = new Set(importers.flatMap((file) => file.read));
    const base = { check: input.spec.name, line: 1, fixable: false };
    const unused = defined
        .filter((entry) => !read.has(entry) && !read.has(camel(entry)))
        .map((entry) => ({
            ...base,
            file: sheet,
            rule: 'unused-class',
            message: `No importer reads the class ${entry}.`,
        }));
    const missing = importers.flatMap((file) =>
        file.read
            .filter((entry) => !known.has(entry))
            .map((entry) => ({
                ...base,
                file: file.path,
                rule: 'undefined-class',
                message: `${name} defines no class ${entry}.`,
            })),
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
    const paths = input.files.filter((file) => file.nature === 'source').map((file) => file.path);
    const code = paths
        .filter((path) => CODE_SUFFIX.test(path))
        .map((path) => ({ path, text: readSource(input.root, path, input.observations).toString('utf8') }));
    const findings: Finding[] = [];
    const sheets = paths.filter((path) => MODULE_SUFFIX.test(path));
    const importers = moduleImporters(code, new Set(sheets));
    for (const sheet of sheets) {
        const defined = definedClasses(readSource(input.root, sheet, input.observations).toString('utf8'), sheet);
        findings.push(...sheetFindings(input, sheet, defined, importers.get(sheet) ?? []));
    }
    return findings;
}
