import type { z } from 'zod';
import type ts from 'typescript';
import type { Node as SqlNode } from '@pgsql/types';
import type { Node, Tree, Parser } from 'web-tree-sitter';
import type { parseDocument } from '@decimalturn/toml-patch';
import type { RunCache, TextRange } from '#cli/types/system.ts';
import type { GRAMMAR_NAMES, PYTHON_LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers.ts';

import type {
    pipfileSchema,
    pbxprojSchema,
    tsconfigSchema,
    pyprojectSchema,
    packageJsonSchema,
} from '#cli/schemas/parsers.ts';

export type TrapScript = {
    trap: Node;
    body: Node;
    syntaxRoot: Node;
    sourceRows: { offset: number; line: number }[];
};

type CommandCall = {
    name: string;
    count: number;
    line: number;
    forwards: boolean;
};

export type ScriptFunction = {
    name: string;
    start: number;
    end: number;
    highestRead: number;
    branches: number;
    nesting: number;
    assignments: number;
};

export type TemporaryPath = { name: string; line: number; cleanupLines: number[] };

export type ScriptTemporaryPaths = {
    paths: TemporaryPath[];
    variables: Map<string, TemporaryPath>;
    assigned: Set<string>;
};

export type TrapCleanup = {
    sourceRows: TrapScript['sourceRows'];
    owner: number | undefined;
    temporaryPaths: ScriptTemporaryPaths;
    lines: Map<number, Array<TemporaryPath | undefined>>;
};

export type BashForm =
    | 'function-keyword'
    | 'typeset'
    | 'combined-redirect'
    | 'combined-pipe'
    | 'brace-for'
    | 'seq-loop'
    | 'script-ifs';

export type ScriptSyntax = {
    commands: { name: string; arguments: (string | undefined)[]; line: number }[];
    forms: { form: BashForm; line: number }[];
    swallowedLines: number[];
    statements: { kind: string; text: string; line: number }[];
    code: string[];
    functions: ScriptFunction[];
    calls: CommandCall[];
    temporaryPaths: TemporaryPath[];
};

type GrammarFile = { path: string; grammar: GrammarName };

export type GrammarName = (typeof GRAMMAR_NAMES)[number];

export type ParseCache = { cache: RunCache; resources?: Disposable[] };

export type GrammarSourceFiles = ParseCache & { files: GrammarFile[] };

export type SourceTree = { path: string; text: string; rootNode: Node };

export type ParserGrammars = {
    runtime: Promise<void> | undefined;
    parsers: Map<GrammarName, Promise<Parser>>;
    parses: number;
};

export type SourceComment = { line: number; text: string; standalone: boolean };

export type CommentParser = (text: string, path: string) => SourceComment[] | Promise<SourceComment[]>;

export type ComponentScript = { grammar: GrammarName; source: string };

export type EnvironmentRead = { key: string | undefined; line: number; column: number; hasDefault?: true };

export type EnvironmentKind = 'os' | 'environ' | 'getenv' | undefined;

export type EnvironmentScope = Map<string, EnvironmentKind>;

export type EnvironmentNames = Map<number, Map<string, { position: number; kind: EnvironmentKind }[]>>;

export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree & Disposable;
    statements: Node[];
};

export type PythonFunction = { path: string; name: string; node: Node; body: Node[] };

export type PythonFiles = { modules: PythonModule[]; functions: PythonFunction[] };

export type SourceFiles = Required<ParseCache> & { files: { path: string; kind: string }[] };

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

export type KeyPath = readonly (string | number)[];

export type EditableFile = {
    getValue(keys: KeyPath): unknown;
    set(keys: KeyPath, value: unknown): void;
    getText(): string;
};

export type CodeFence = { language: string; attributes: string; body: string; startLine: number; endLine: number };

export type DirectiveScan = { token: string | undefined; end: number };

type TomlComment = { raw: string; start: number; line: number };

type TomlCommentBlock = { path: KeyPath; owned: TomlComment[]; free: TomlComment[] };

export type TomlBlock = ReturnType<typeof parseDocument>['cst'][number];

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
    document: ReturnType<typeof parseDocument>;
    value: Record<string, unknown>;
    pathNodes: TomlPathNode[];
    comments: TomlCommentNode[];
};

export type TomlComments = Map<string, TomlCommentBlock>;

export type TomlTablePositions = {
    value: Record<string, unknown>;
    counts: Map<string, number>;
    active: Map<string, number>;
};

export type TomlTextChunk = { start: number; end: number; text: string };

export type TomlAnchoredComment = { comment: TomlCommentNode; anchor: TomlPathNode | undefined; identity: string };

export type TomlCommentPlacement = {
    kind: string;
    path: KeyPath | undefined;
    comment: TomlCommentNode;
    placement: 'owned' | 'free';
};

export type TomlCommentMove = { source: TomlAnchoredComment; found: TomlAnchoredComment | undefined };

export type PackageJson = z.infer<typeof packageJsonSchema>;

export type Dependencies = Record<string, string>;

export type DependencyFile = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: Dependencies;
    installed: Dependencies;
    runtimes?: Record<string, string>;
};

export type DependencyFileParser = (path: string, text: string) => DependencyFile | Promise<DependencyFile>;

export type PythonDependency = NonNullable<z.infer<typeof pipfileSchema>['packages']>[string];

export type Pyproject = z.infer<typeof pyprojectSchema>;

export type LockfileName = (typeof JAVASCRIPT_LOCKFILES)[number];

export type LockedPackageLockfile = LockfileName | (typeof PYTHON_LOCKFILES)[number];

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
    targets: { name: string; sources: string[]; folders: TargetFolder[] }[];
};

export type ProjectBuildTarget = {
    name: string;
    isStrict: boolean;
    scripts: { name: string; script: string; hasFiles: boolean }[];
};

export type ProjectBuildSettings = { sdkRoot: string | undefined; swiftVersion: string | undefined };

export type ProjectTokens = { tokens: string[]; index: number };

export type Parsed<Value, Failure = string> = { value: Value } | { error: Failure };

export type NumberedLine = { text: string; number: number };

export type SourcePosition = { start: { offset: number }; end: { offset: number } };
