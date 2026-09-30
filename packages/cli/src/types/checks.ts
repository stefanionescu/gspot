// The types of the checks in this package.
import type { z } from 'zod';
import type { Node, Tree } from 'web-tree-sitter';
import type { Read, Root } from '#cli/types/platform.ts';
import type { ToolSearch } from '#cli/types/tools/tools.ts';
import type { reportSchema } from '#cli/checks/jest/run.ts';
import type { Manifest, CheckSpec } from '#cli/types/kits.ts';
import type { matchSchema } from '#cli/checks/bash/ast-grep.ts';
import type { configurationSchema } from '#cli/checks/licenses.ts';
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';
import type { projectSchema } from '#cli/checks/xcode/project/reader.ts';
import type { SqlFile, SqlStatementView } from '#cli/types/parsers/sql.ts';
import type { cloneReportSchema } from '#cli/checks/docs/copied-blocks.ts';
import type { findingSchema, checkResultSchema } from '#cli/checks/result.ts';
import type { Session, PlannedCheck } from '#cli/types/execution/execution.ts';
import type { Defined, MergedView, PolicyFiles, ScopeSelection } from '#cli/types/policy/policy.ts';
import type { Repository, ScopeEntry, SourceReads, TrackedFile } from '#cli/types/repository/repository.ts';

export type SqlSource = { path: string; text: string };
export type FunctionOption = {
    DefElem: { defname: string; arg: { String?: { sval: string }; List?: { items: { String: { sval: string } }[] } } };
};
export type SqlAnalysis = {
    input: EngineInput;
    source: SqlSource;
    parsed: SqlFile;
    threshold: number;
    maximum: number;
};
export type LicensedPackage = { name: string; license: string };

export type LicenseException = z.infer<typeof configurationSchema>['packages_allowed'][number];
export type Translations = { directory?: string; base?: string };
export type EngineInput = {
    policyFiles: PolicyFiles;
    selection: ScopeSelection;
    manifests: Map<string, Manifest>;
    inspections: ToolSearch['inspections'];
    scopeEntries: ScopeEntry[];
    attributes: Repository['attributes'];
    hasGit: boolean;
    reads: SourceReads;
    resources?: DisposableStack;
    cancelSignal?: AbortSignal;
    scopeRoot: string;
    repositoryFiles?: TrackedFile[];
    generatedDrift?: () => DriftEntry[];
    suppressions?: SuppressionComment[];
    root: string;
    scope: string;
    view: MergedView;
    spec: CheckSpec;
    files: TrackedFile[];
    staged?: Set<string>;
};
export type EngineOutcome = { findings: Finding[]; checkedFiles: string[] };
export type Engine = (input: EngineInput) => Finding[] | EngineOutcome | Promise<Finding[] | EngineOutcome>;
export type SuppressionForm = {
    form: string;
    marker: RegExp;
    inlineMarker: RegExp;
    reason: RegExp;
    forbidden: boolean;
};
export type SuppressionComment = { file: string; line: number; form: string; reason?: string; forbidden: boolean };
export type Finding = Defined<z.infer<typeof findingSchema>>;
export type CheckResult = Defined<Omit<z.infer<typeof checkResultSchema>, 'findings'>> & {
    findings: Finding[];
};
export type Importer = { path: string; read: string[] };
export type MarkupProblem = { node: Node; rule: string; text: string };
export type MarkupAttribute = { name: string; value: string; element: string; node: Node };

/** Where a finding points: the file, and the line and column when the check knows them. */
export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

export type PathIndex = { known: Set<string>; tasks: Set<string>; isException: (path: string) => boolean };
export type ProseLine = { number: number; line: string };
/** The validated native duplication report consumed by finding generation. */
export type CloneReport = z.infer<typeof cloneReportSchema>;
export type FencedBlock = { line: number; language: string; body: string };
export type ShapeProblem = [number, string, string];

export type JestRun = { input: EngineInput; source: string; work: string };
export type TestReport = z.infer<typeof reportSchema>;
export type Suite = TestReport['testResults'][number];

/** One identifier an extractor found. */
export type Identifier = {
    file: string;
    line: number;
    column: number;
    language: string;
    category: string;
    /** The label a finding prints, such as `typescript function`. */
    kind: string;
    name: string;
    /** For a directory name: the directory path, so a path rule can match it. */
    directory?: string;
};
/** Where an extractor puts what it finds. */
export type ExtractSink = { file: string; language: string; out: Identifier[] };
/** One thing wrong with one identifier. */
export type NameProblem = {
    rule:
        | 'case'
        | 'digits'
        | 'length'
        | 'words'
        | 'duplicate-words'
        | 'banned-term'
        | 'reserved-term'
        | 'callback-verb';
    message: string;
    source?: string;
};
/** What the engine needs to check a file's identifiers: the policy and the language the file belongs to. */
export type NamingInputs = { policy: EffectivePolicy; isReactFile: boolean; isTestFile: boolean };
/** The shipped policy file, kits/general/naming/policy.json. */
export type ShippedPolicy = {
    version: number;
    matching: { wholeParts: boolean; caseInsensitive: boolean };
    banDigits: boolean;
    banDuplicateWords: boolean;
    groups: Record<string, { removable: boolean; terms: string[] }>;
    reserved: { term: string; allowedFor: string[] }[];
    external: string[];
    languages: Record<string, ShippedLanguage>;
    rules: ShippedRule[];
};
/** One language's table in the shipped policy. */
export type ShippedLanguage = {
    maxChars: number;
    maxWords: number;
    acronyms: 'word' | 'initialism' | 'lower';
    categories: Record<string, { case: string[] }>;
};
/** One path-scoped rule in the shipped policy. */
export type ShippedRule = {
    paths: string[];
    languages?: string[] | undefined;
    categories?: string[] | undefined;
    names?: string[] | undefined;
    exclude?: boolean | undefined;
    reason?: string | undefined;
    allowDigits?: boolean | undefined;
    allowDuplicateWords?: boolean | undefined;
    structuralPrefix?: string | undefined;
    case?: string[] | undefined;
};
/** A banned term split into parts, with where it came from. */
export type Term = { term: string; parts: string[]; source: string };
/** A path-scoped rule, compiled. */
export type PathRule = {
    isPath: (path: string) => boolean;
    languages: Set<string> | undefined;
    categories: Set<string> | undefined;
    names: Set<string> | undefined;
    isExcluding: boolean;
    isDigitsAllowed: boolean;
    isDuplicatesAllowed: boolean;
    structuralPrefix: RegExp | undefined;
    caseNames: string[] | undefined;
    source: string;
};
/** The ceilings and cases one identifier category gets. */
export type CategoryLimits = { caseNames: string[]; maxChars: number; maxWords: number };
/** The policy after gspot.toml is merged in, ready to validate against. */
export type EffectivePolicy = {
    terms: Term[];
    reserved: Map<string, string[]>;
    external: Set<string>;
    allowed: Map<string, string | undefined>;
    contractProperties: Map<string, Set<string>>;
    rules: PathRule[];
    languages: Record<string, ShippedLanguage>;
    limitsFor: (language: string, category: string) => CategoryLimits;
    isDigitsBanned: boolean;
    isDuplicatesBanned: boolean;
};

export type DirectiveScan = { token: string | undefined; end: number };

/** One repository configuration copied for a container mount. */
export type Mount = { path: string; source: string; target: string; text: string };

/** One parsed migration file. */
export type Migration = {
    path: string;
    name: string;
    /** The digits that lead the file name; empty when it has none. */
    version: string;
    text: string;
    statements: SqlStatementView[];
};
/** Where a fact was declared, so a finding points at it. */
export type Declared = { path: string; offset: number; text: string };
/** One foreign key column of a table. */
export type ForeignKey = Declared & { table: string; column: string };
/** What the migrations say about the schema, read across every file. */
export type Schema = {
    /** Qualified table name to where it was created. */
    tables: Map<string, Declared>;
    secured: Set<string>;
    policed: Set<string>;
    foreignKeys: ForeignKey[];
    /** Qualified table name to the leading column of each index and key on it. */
    indexed: Map<string, Set<string>>;
};
/** One layout problem of a documented migration. */
export type DocProblem = { line: number; rule: string; text: string };
export type SchemaState = Pick<Schema, 'tables' | 'secured'> & {
    policies: Map<string, Set<string>>;
    indexes: { table: string; name: string; column: string; constraint: string }[];
    constraints: Map<string, Map<string, Schema['foreignKeys']>>;
};
export type Reader = (fields: SchemaState, migration: Migration, statement: SqlStatementView) => void;
export type Location = { migration: Migration; statement: SqlStatementView; table: string };

/** One Vale alert, parsed. */
export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };
export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

/** One parsed Python module. */
export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree;
    /** The top-level statements, with a decorated definition unwrapped to its definition. */
    statements: Node[];
};
/** One top-level or nested function with what the analyses read from it. */
export type PythonFunction = {
    path: string;
    name: string;
    node: Node;
    /** The statements of the body, the docstring left out. */
    body: Node[];
};
/** The modules and functions of one run, parsed once. */
export type ParsedModules = { modules: PythonModule[]; functions: PythonFunction[] };
/** One structure analysis over the parsed modules. */
export type StructureReader = (parsed: ParsedModules, input: EngineInput) => StructureProblem[];

export type PathPattern = { pattern: string; where: string };

export type SecretScan = { session: Session; planned: PlannedCheck; input: string };

export type BaselineReason = { fingerprint: string; reason: string };
export type GitleaksFinding = { Fingerprint: string; File: string; RuleID: string; Commit?: string };
export type AcceptedResult = { rule: string; paths: string[]; reason: string };

export type SizeLimit = { paths: string[]; kb: number; reason?: string };
/** The output of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string;
    output: string;
    isBuilt: boolean;
    said: string;
};

/** One analysis: a function over the context that returns findings. */
export type StructureAnalysis = (
    context: StructureInput,
    scripts: () => Promise<ScriptIndex>,
) => Finding[] | Promise<Finding[]>;
export type Language = 'python' | 'swift' | 'bash';
export type Substance = (node: Node, language: Language, threshold: number) => boolean;
/** What every analysis receives. */
export type StructureInput = {
    input: EngineInput;
    /** The files this check runs over. */
    files: TrackedFile[];
    /** A limit by its `[limits]` key, read for the file's language. */
    limit: (key: string, language?: string) => number | undefined;
    /** A `[tools.bash]` text slot, or the fallback. */
    bashText: (slot: string, otherwise: string) => string;
    /** A `[tools.bash]` list slot, empty when unset. */
    bashList: (slot: string) => string[];
    /** A `[tools.bash]` slot as written. */
    bashSetting: (slot: string) => unknown;
};
export type StructureProblem = { file: string; line: number; rule: string; text: string };
/** One shell function: its name, its declaration line and closing line (one-based), and the lines between the braces. */
export type ScriptFunction = { name: string; start: number; end: number; body: string[]; statements: number };
/** One shell script the engine reads. */
export type ScriptFile = {
    path: string;
    text: string;
    lines: string[];
    functions: ScriptFunction[];
    isExecutable: boolean;
    /** Identifier tokens outside declaration lines, by name, with the lines they appear on. */
    references: Map<string, number[]>;
    /** Names assigned at the top level, outside every function. */
    assignments: Set<string>;
};
/** The shell scripts of one scope, with the function owners across them. */
export type ScriptIndex = { files: ScriptFile[]; owners: Map<string, string> };
/** How an analysis reports one problem in one file. */
export type ScriptReport = (line: number, rule: string, text: string) => void;
export type Edge = ImportIndex['edges'][number];
export type EdgeSource = { input: EngineInput; path: string; owned: Set<string> };
export type ImportIndex = {
    paths: string[];
    importers: Map<string, Set<string>>;
    edges: { from: string; to: string; source: string; line: number; column: number }[];
};
/** An entry a directory holds, as the tracked file list sees it. */
export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };
/** A validated native structural match with zero-based line positions. */
export type AstGrepMatch = z.infer<typeof matchSchema>;
/** A line of a shell script with its comment stripped, keyed by its one-based number. */
export type CodeLine = { number: number; code: string };

/** One parsed Swift file of a run. */
export type SwiftSource = { path: string; text: string; lines: string[]; tree: Tree };
/** Source comments whose inline documentation positions need native findings restored. */
export type InlineDocumentation = { source: SwiftSource; comments: Node[]; inline: Node[] };
/** One Swift function with what the structure checks ask about it. */
export type SwiftFunction = {
    path: string;
    node: Node;
    name: string;
    /** The statements of the body. */
    body: Node[];
};
/** The files and functions of one run, parsed one time. */
export type ParsedSwift = { sources: SwiftSource[]; functions: SwiftFunction[] };
/** One structure analysis over the parsed Swift files. */
export type SwiftReader = (parsed: ParsedSwift, input: EngineInput) => StructureProblem[];
export type Pruning = {
    folder: string;
    files: Root;
    desired: Map<string, Read>;
    wanted: Set<string>;
};
/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The cache folder of this scope. */
    folder: string;
    /** Where the compiler log is written. */
    log: string;
    argv: string[];
    /** The analyzer clears this folder so its log includes every compiler call. */
    scratch?: string;
};
/** The read build status and its compiler output. */
export type SwiftBuildOutput = { code: number; output: string };

/** The part of an xccov report the coverage check reads. */
export type XcodeCoverageReport = { targets?: { name: string; lineCoverage: number }[] };
export type Plist = string | Plist[] | { [key: string]: Plist };
export type Token = { text: string; quoted: boolean; at: number };
export type ProjectEntry = z.infer<typeof projectSchema>['objects'][string];
export type ProjectRoot = ProjectEntry & { mainGroup: string };
export type XcodeProject = {
    objects: Record<string, ProjectEntry>;
    root: ProjectRoot;
    directory: string;
    parents: Map<string, string>;
    visiting: Set<string>;
};
export type Folder = { path: string; excluded: Set<string> };
/** The part of a string catalog the checks read. */
export type StringsFile = {
    sourceLanguage?: string;
    strings?: Record<string, { shouldTranslate?: boolean; localizations?: Record<string, unknown> }>;
};
/** The part of an asset Contents.json the checks read. */
export type AssetContents = { images?: { filename?: string }[] };
/** The part of a test plan the checks read. */
export type TestPlan = {
    testTargets?: { target?: { name?: string }; skippedTests?: string[] }[];
};
/** One coverage floor of the policy. */
export type CoverageFloor = { target: string; percent: number };
