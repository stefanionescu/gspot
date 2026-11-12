import type { parseDocument } from '@decimalturn/toml-patch';
import type { Node as SqlNode } from '@pgsql/types';
import type ts from 'typescript';
import type { Node, Parser, Tree } from 'web-tree-sitter';
import type { z } from 'zod';

import type { GRAMMAR_NAMES } from '#cli/config/parsers/code.ts';
import type { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects.ts';
import type {
    packageJsonSchema,
    pbxprojSchema,
    pipfileSchema,
    pyprojectSchema,
    tsconfigSchema,
} from '#cli/schemas/parsers.ts';
import type { RunCache, TextRange } from '#cli/types/system.ts';

export type TrapScript = {
    trap: Node;
    body: Node;
    syntaxRoot: Node;
    sourceRows: Array<{ offset: number; line: number }>;
};

type CommandCall = {
    name: string;
    count: number;
    line: number;
    forwards: boolean;
};

type ScriptFunction = {
    name: string;
    start: number;
    end: number;
    highestRead: number;
    branches: number;
    nesting: number;
    assignments: number;
};

export type TemporaryPath = { name: string; line: number; cleanupLines: number[]; removalLines: number[] };

export type ScriptTemporaryPaths = {
    paths: TemporaryPath[];
    variables: Map<string, TemporaryPath>;
    assigned: Set<string>;
};

export type TrapCleanup = {
    sourceRows: TrapScript['sourceRows'];
    owner: number | undefined;
    temporaryPaths: ScriptTemporaryPaths;
    removals: Removal[];
};

export type BashForm =
    | 'function-keyword'
    | 'typeset'
    | 'combined-redirect'
    | 'combined-pipe'
    | 'brace-for'
    | 'seq-loop'
    | 'script-ifs'
    | 'curl-pipe-shell';

export type Removal = { line: number; paths: TemporaryPath[] };

export type ScriptSyntax = {
    commands: Array<{ name: string; arguments: Array<string | undefined>; line: number }>;
    forms: Array<{ form: BashForm; line: number }>;
    swallowedLines: number[];
    statements: Array<{ kind: string; text: string; line: number }>;
    code: string[];
    functions: ScriptFunction[];
    calls: CommandCall[];
    temporaryPaths: TemporaryPath[];
};

export type GrammarName = (typeof GRAMMAR_NAMES)[number];

export type ParseCache = { cache: RunCache; resources?: Disposable[] };

export type GrammarSourceFiles<Grammar extends GrammarName = GrammarName> = ParseCache & {
    files: Array<{ path: string; grammar: Grammar }>;
};

export type SourceTree<Grammar extends GrammarName = GrammarName> = {
    path: string;
    grammar: Grammar;
    text: string;
    rootNode: Node;
};

export type ParserGrammars = {
    runtime: Promise<void> | undefined;
    parsers: Map<string, Promise<Parser>>;
    parses: number;
};

export type SourceComment = { line: number; text: string; standalone: boolean };

export type CommentParser = (text: string, path: string) => SourceComment[] | Promise<SourceComment[]>;

export type ComponentScript = { grammar: GrammarName; source: string };

export type EnvironmentRead = { key: string | undefined; line: number; column: number; hasDefault?: true };

export type EnvironmentKind = 'os' | 'environ' | 'getenv' | undefined;

export type EnvironmentScope = Map<string, EnvironmentKind>;

export type EnvironmentNames = Map<number, Map<string, Array<{ position: number; kind: EnvironmentKind }>>>;

export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree & Disposable;
    statements: Node[];
};

export type PythonFunction = { path: string; name: string; node: Node; body: Node[] };

export type PythonFiles = { modules: PythonModule[]; functions: PythonFunction[] };

export type SourceFiles = Required<ParseCache> & { files: Array<{ path: string; kind: string }> };

export type SqlToken = {
    start: number;
    end: number;
    kind: 'block-comment' | 'line-comment' | 'dollar' | 'command' | 'variable' | 'other';
};

export type BlankedSql = { text: string; variables: TextRange[] };

export type SqlNodeFields = { [Variant in SqlNode as keyof Variant]: Variant[keyof Variant] };

export type SqlStatement<Kind extends keyof SqlNodeFields = keyof SqlNodeFields> = {
    [Name in Kind]: { kind: Name; fields: SqlNodeFields[Name]; start: number };
}[Kind];

export type SqlFile = {
    source: string;
    variables: TextRange[];
    statements: SqlStatement[];
    error: { text: string; line: number; column: number } | undefined;
};

export type MatchedToken = Omit<SqlToken, 'start'>;

export type KeyPath = ReadonlyArray<string | number>;

export type EditableFile = {
    getValue(keys: KeyPath): unknown;
    set(keys: KeyPath, value: unknown): void;
    getText(): string;
};

export type CodeFence = { language: string; attributes: string; body: string; startLine: number; endLine: number };

type TomlComment = { raw: string; start: number };

export type TomlDocument = ReturnType<typeof parseDocument>;

export type TomlBlock = TomlDocument['cst'][number];

export type TomlLocation = TomlBlock['loc'];

export type TomlKeyValue = Extract<TomlBlock, { type: 'KeyValue' }>;

export type TomlValue = TomlKeyValue['value'];

export type TomlCommentNode = Extract<TomlBlock, { type: 'Comment' }>;

export type SourceRange = { range?: readonly [number, number] };

export type TomlTableOptions = { filePath: string; keys: KeyPath; create: boolean };

export type TomlPathNode = { path: KeyPath } & (
    | { kind: 'key'; node: TomlKeyValue }
    | { kind: 'item'; node: TomlValue }
    | { kind: 'header'; node: Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>['key'] }
);

export type TomlSyntax = {
    document: TomlDocument;
    value: Record<string, unknown>;
    pathNodes: TomlPathNode[];
    comments: TomlCommentNode[];
};

export type TomlComments = Map<string, TomlComment[]>;

export type TomlTablePositions = {
    value: Record<string, unknown>;
    counts: Map<string, number>;
    active: Map<string, number>;
};

export type TomlTextChunk = { start: number; end: number; text: string };

export type TomlAnchoredComment = { comment: TomlCommentNode; anchor: TomlPathNode | undefined; identity: string };

export type TomlCommentMove = { source: TomlAnchoredComment; found: TomlAnchoredComment | undefined };

export type PackageJson = z.infer<typeof packageJsonSchema>;

export type Dependencies = Record<string, string>;

export type DependencyFile = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: Dependencies;
    installed: Dependencies;
    runtimes?: Record<string, string>;
    scripts?: string[];
    moduleType?: string;
};

export type DependencyFileParser = (path: string, text: string) => DependencyFile | Promise<DependencyFile>;

export type PythonDependency = NonNullable<z.infer<typeof pipfileSchema>['packages']>[string];

export type Pyproject = z.infer<typeof pyprojectSchema>;

export type LockfileName = (typeof JAVASCRIPT_LOCKFILES)[number];

export type ParsedTsconfig = Omit<ts.ParsedCommandLine, 'raw'> & {
    raw: z.infer<typeof tsconfigSchema>;
    tsconfigFiles: string[];
    extendedTsconfigFiles: string[];
};

export type TypeScriptProject = {
    path: string;
    config: ParsedTsconfig;
    projects: Map<string, ParsedTsconfig>;
};

export type PbxElement = z.infer<typeof pbxprojSchema>['objects'][string];

export type ParsedPbxproj = { objects: Record<string, PbxElement>; root: PbxElement };

export type XcodeProject = {
    objects: Record<string, PbxElement>;
    root: PbxElement & { mainGroup: string };
    folder: string;
    parents: Map<string, string>;
    visiting: Set<string>;
};

export type TargetFolder = { path: string; excluded: Set<string> };

export type ProjectSources = {
    sources: Set<string>;
    folders: TargetFolder[];
    targets: Array<{ name: string; sources: string[]; folders: TargetFolder[] }>;
};

export type ProjectBuildTarget = {
    name: string;
    isStrict: boolean;
    scripts: Array<{ name: string; script: string; hasFiles: boolean }>;
};

export type ProjectBuildSettings = { sdkRoot: string | undefined; swiftVersion: string | undefined };

export type ProjectTokens = { tokens: string[]; index: number };

export type Parsed<Value, Failure = string> = { value: Value } | { error: Failure };

export type NumberedLine = { text: string; number: number };

export type SourcePosition = { start: { offset: number }; end: { offset: number } };
