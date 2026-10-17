import ts from 'typescript';
import { join, relative } from 'node:path';
import { buildFinding } from '#cli/checks/finding.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { listTypescriptNodes } from '#cli/parsers/typescript.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { readTsconfig, buildCompilerHost } from '#cli/parsers/tsconfig.ts';
import { EXPORTED_FUNCTION_EXTENSIONS } from '#cli/config/checks/general/structure.ts';

function buildExportProgram(input: CheckInput, paths: string[]): ts.Program {
    const scope = input.selection.scope.path;
    const config =
        readTsconfig(input.root, join(input.root, scope, 'tsconfig.json'), input.reads) ??
        readTsconfig(input.root, join(input.root, scope, 'jsconfig.json'), input.reads);
    const options = {
        module: ts.ModuleKind.Preserve,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        ...config?.options,
        noLib: true,
        types: [],
        allowJs: true,
        noEmit: true,
        jsx: ts.JsxEmit.Preserve,
    };
    const owned = new Set(paths.map((path) => convertToPosixPath(join(input.root, path))));
    const host = buildCompilerHost(input.root, scope, input.reads, options);
    host.resolveModuleNameLiterals = (literals, file) => {
        const path = convertToPosixPath(relative(input.root, file));
        const scope = findScope(path, input.scopes).path;
        const config =
            readTsconfig(input.root, join(input.root, scope, 'tsconfig.json'), input.reads) ??
            readTsconfig(input.root, join(input.root, scope, 'jsconfig.json'), input.reads);
        return literals.map(({ text: name }) => {
            const importedModule = ts.resolveModuleName(
                name,
                file,
                { ...options, ...config?.options },
                host,
            ).resolvedModule;
            if (importedModule === undefined) return { resolvedModule: undefined };
            const target = (host.realpath as NonNullable<ts.CompilerHost['realpath']>)(importedModule.resolvedFileName);
            return {
                resolvedModule: owned.has(convertToPosixPath(target))
                    ? { ...importedModule, resolvedFileName: target }
                    : undefined,
            };
        });
    };
    return ts.createProgram({ rootNames: paths.map((path) => join(input.root, path)), options, host });
}

function recordImporter(importers: Map<ts.Symbol, Set<string>>, symbol: ts.Symbol, path: string): void {
    const files = importers.get(symbol) ?? new Set<string>();
    files.add(path);
    importers.set(symbol, files);
}

function recordNamedImports(
    checker: ts.TypeChecker,
    nodes: ts.Node[],
    source: ts.SourceFile,
    importers: Map<ts.Symbol, Set<string>>,
): void {
    for (const node of nodes) {
        if (!ts.isImportSpecifier(node) && !ts.isImportClause(node) && !ts.isExportSpecifier(node)) continue;
        const name = node.name;
        if (name === undefined) continue;
        const imported = checker.getSymbolAtLocation(name);
        if (imported === undefined || !(imported.flags & ts.SymbolFlags.Alias)) continue;
        recordImporter(importers, checker.getAliasedSymbol(imported), source.fileName);
    }
}

function recordPropertyImports(
    checker: ts.TypeChecker,
    nodes: ts.Node[],
    source: ts.SourceFile,
    importers: Map<ts.Symbol, Set<string>>,
): void {
    for (const node of nodes.filter((node) => ts.isPropertyAccessExpression(node))) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol === undefined) continue;
        const declaration = symbol.valueDeclaration;
        if (declaration === undefined || declaration.getSourceFile() === source) continue;
        recordImporter(importers, symbol, source.fileName);
    }
}

function findImporters(program: ts.Program): Map<ts.Symbol, Set<string>> {
    const checker = program.getTypeChecker();
    const importers = new Map<ts.Symbol, Set<string>>();
    for (const source of program.getSourceFiles()) {
        const nodes = listTypescriptNodes(source);
        recordNamedImports(checker, nodes, source, importers);
        recordPropertyImports(checker, nodes, source, importers);
    }
    return importers;
}

function readCallableDeclaration(declaration: ts.Declaration | undefined): ts.Node | undefined {
    if (declaration === undefined) return undefined;
    if (ts.isVariableDeclaration(declaration)) return declaration.initializer;
    if (ts.isBinaryExpression(declaration)) return declaration.right;
    if (ts.isExportAssignment(declaration)) return declaration.expression;
    return declaration;
}

function findExportedFunction(
    symbol: ts.Symbol,
): ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | undefined {
    const callable = readCallableDeclaration(symbol.valueDeclaration);
    if (
        callable === undefined ||
        !(ts.isFunctionDeclaration(callable) || ts.isFunctionExpression(callable) || ts.isArrowFunction(callable)) ||
        callable.body === undefined
    )
        return undefined;
    return callable;
}

function readSingleExpression(body: ts.ConciseBody): ts.Expression | undefined {
    if (!ts.isBlock(body)) return body;
    const statement = body.statements.length === 1 ? body.statements[0] : undefined;
    if (statement !== undefined && (ts.isReturnStatement(statement) || ts.isExpressionStatement(statement)))
        return statement.expression;
    return undefined;
}

function findForwardedExpression(body: ts.ConciseBody): ts.Expression | undefined {
    const expression = readSingleExpression(body);
    if (expression === undefined) return undefined;
    const operations = listTypescriptNodes(expression);
    return operations.some((node) => ts.isFunctionLike(node)) ||
        operations.filter((node) => ts.isCallExpression(node)).length > 1
        ? undefined
        : expression;
}

function checkModuleExports(
    input: CheckInput,
    program: ts.Program,
    importers: Map<ts.Symbol, Set<string>>,
    source: ts.SourceFile,
): Finding[] {
    const checker = program.getTypeChecker();
    const module = checker.getSymbolAtLocation(source);
    if (module === undefined) return [];
    const path = convertToPosixPath(relative(input.root, source.fileName));
    return [...(module.exports?.values() ?? [])].flatMap((exported): Finding[] => {
        const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        if (importers.get(symbol)?.size !== 1) return [];
        const callable = findExportedFunction(symbol);
        if (
            callable === undefined ||
            convertToPosixPath(relative(input.root, callable.getSourceFile().fileName)) !== path ||
            findForwardedExpression(callable.body as ts.ConciseBody) === undefined
        )
            return [];
        const name = symbol.getName() === 'export=' ? 'The default export' : symbol.getName();
        return [
            buildFinding(
                input,
                { file: path, line: source.getLineAndCharacterOfPosition(callable.getStart(source)).line + 1 },
                'trivial-function',
                `${name} forwards one expression to one importing file. Move it into its caller, or record the API it serves with gspot ignore.`,
            ),
        ];
    });
}

/**
 * Reports exported functions that forward one expression and have one importing file.
 * @param input the files to check.
 * @returns the findings.
 */
export function checkExportedFunctions(input: CheckInput): Finding[] {
    const sources = input.repositoryFiles.filter(
        (file) =>
            file.kind === 'source' &&
            !isInGspotFolder(file.path) &&
            EXPORTED_FUNCTION_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    const selected = new Set(input.files.map(({ path }) => path));
    if (!sources.some(({ path }) => selected.has(path))) return [];
    const program = buildExportProgram(
        input,
        sources.map(({ path }) => path),
    );
    const importers = findImporters(program);
    return sources
        .filter(({ path }) => selected.has(path))
        .flatMap(({ path }) =>
            checkModuleExports(
                input,
                program,
                importers,
                program.getSourceFile(join(input.root, path)) as ts.SourceFile,
            ),
        );
}
