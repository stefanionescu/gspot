import ts from 'typescript';
import { join, relative } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { findScope } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { listTypescriptNodes } from '#cli/parsers/typescript.ts';
import { readTsconfig, buildCompilerHost } from '#cli/parsers/tsconfig.ts';
import { EXPORTED_FUNCTION_EXTENSIONS } from '#cli/config/checks/structure.ts';
import { JSCONFIG_FILE, TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';

// The compiler project of a scope: its tsconfig.json, or its jsconfig.json when it has none.
function readScopeProject(session: Session, scope: string) {
    return (
        readTsconfig(session.root, join(session.root, scope, TSCONFIG_FILE), session.reads) ??
        readTsconfig(session.root, join(session.root, scope, JSCONFIG_FILE), session.reads)
    );
}

function buildExportProgram(session: Session, planned: PlannedCheck, paths: string[]): ts.Program {
    const scope = planned.selection.scope.path;
    const config = readScopeProject(session, scope);
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
    const owned = new Set(paths.map((path) => convertToPosixPath(join(session.root, path))));
    const host = buildCompilerHost(session.root, scope, session.reads, options);
    host.resolveModuleNameLiterals = (literals, file) => {
        const path = convertToPosixPath(relative(session.root, file));
        const scope = findScope(path, session.repository.scopeFolders).path;
        const config = readScopeProject(session, scope);
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
    return ts.createProgram({ rootNames: paths.map((path) => join(session.root, path)), options, host });
}

function addImporter(importers: Map<ts.Symbol, Set<string>>, symbol: ts.Symbol, path: string): void {
    const files = importers.get(symbol) ?? new Set<string>();
    files.add(path);
    importers.set(symbol, files);
}

function addNamedImports(
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
        addImporter(importers, checker.getAliasedSymbol(imported), source.fileName);
    }
}

function addPropertyImports(
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
        addImporter(importers, symbol, source.fileName);
    }
}

function findImporters(program: ts.Program): Map<ts.Symbol, Set<string>> {
    const checker = program.getTypeChecker();
    const importers = new Map<ts.Symbol, Set<string>>();
    for (const source of program.getSourceFiles()) {
        const nodes = listTypescriptNodes(source);
        addNamedImports(checker, nodes, source, importers);
        addPropertyImports(checker, nodes, source, importers);
    }
    return importers;
}

function getCallableNode(declaration: ts.Declaration | undefined): ts.Node | undefined {
    if (declaration === undefined) return undefined;
    if (ts.isVariableDeclaration(declaration)) return declaration.initializer;
    if (ts.isBinaryExpression(declaration)) return declaration.right;
    if (ts.isExportAssignment(declaration)) return declaration.expression;
    return declaration;
}

function findExportedFunction(
    symbol: ts.Symbol,
): ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | undefined {
    const callable = getCallableNode(symbol.valueDeclaration);
    if (
        callable === undefined ||
        !(ts.isFunctionDeclaration(callable) || ts.isFunctionExpression(callable) || ts.isArrowFunction(callable)) ||
        callable.body === undefined
    )
        return undefined;
    return callable;
}

function findSingleExpression(body: ts.ConciseBody): ts.Expression | undefined {
    if (!ts.isBlock(body)) return body;
    const statement = body.statements.length === 1 ? body.statements[0] : undefined;
    if (statement !== undefined && (ts.isReturnStatement(statement) || ts.isExpressionStatement(statement)))
        return statement.expression;
    return undefined;
}

function findForwardedExpression(body: ts.ConciseBody): ts.Expression | undefined {
    const expression = findSingleExpression(body);
    if (expression === undefined) return undefined;
    const operations = listTypescriptNodes(expression);
    return operations.some((node) => ts.isFunctionLike(node)) ||
        operations.filter((node) => ts.isCallExpression(node)).length > 1
        ? undefined
        : expression;
}

function isUsedLocally(checker: ts.TypeChecker, nodes: ts.Node[], symbol: ts.Symbol): boolean {
    const declaration = symbol.valueDeclaration;
    if (declaration === undefined) return false;
    return nodes.some(
        (node) =>
            ts.isIdentifier(node) &&
            !ts.isExportSpecifier(node.parent) &&
            (node.end <= declaration.pos || node.pos >= declaration.end) &&
            checker.getSymbolAtLocation(node) === symbol,
    );
}

function isLocalForwarder(
    session: Session,
    module: { checker: ts.TypeChecker; source: ts.SourceFile; path: string },
    symbol: ts.Symbol,
    callable: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction,
): boolean {
    return (
        convertToPosixPath(relative(session.root, callable.getSourceFile().fileName)) === module.path &&
        findForwardedExpression(callable.body as ts.ConciseBody) !== undefined &&
        !isUsedLocally(module.checker, listTypescriptNodes(module.source), symbol)
    );
}

function checkModuleExports(
    session: Session,
    planned: PlannedCheck,
    program: ts.Program,
    importers: Map<ts.Symbol, Set<string>>,
    source: ts.SourceFile,
): Finding[] {
    const checker = program.getTypeChecker();
    const module = checker.getSymbolAtLocation(source);
    if (module === undefined) return [];
    const path = convertToPosixPath(relative(session.root, source.fileName));
    return [...(module.exports?.values() ?? [])].flatMap((exported): Finding[] => {
        const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        if (importers.get(symbol)?.size !== 1) return [];
        const callable = findExportedFunction(symbol);
        if (callable === undefined || !isLocalForwarder(session, { checker, source, path }, symbol, callable))
            return [];
        const name = symbol.getName() === 'export=' ? 'The default export' : symbol.getName();
        return [
            buildFinding(
                planned,
                { file: path, line: source.getLineAndCharacterOfPosition(callable.getStart(source)).line + 1 },
                'trivial-function',
                `${name} forwards one expression to one importing file. Move it into its caller, or record the API it serves with gspot ignore.`,
            ),
        ];
    });
}

/**
 * Reports exported functions that forward one expression and have one importing file.
 *
 * @param session the repository and its tools.
 * @param planned the files to check.
 * @returns the findings.
 */
export function checkExportedFunctions(session: Session, planned: PlannedCheck): Finding[] {
    const sources = session.repository.files.filter(
        (file) =>
            file.kind === 'source' && EXPORTED_FUNCTION_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    const selected = new Set(planned.files.map(({ path }) => path));
    if (!sources.some(({ path }) => selected.has(path))) return [];
    const program = buildExportProgram(
        session,
        planned,
        sources.map(({ path }) => path),
    );
    const importers = findImporters(program);
    return sources
        .filter(({ path }) => selected.has(path))
        .flatMap(({ path }) =>
            checkModuleExports(
                session,
                planned,
                program,
                importers,
                program.getSourceFile(join(session.root, path)) as ts.SourceFile,
            ),
        );
}
