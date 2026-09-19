import type { EngineInput } from '#types/run.ts';
// Type aliases of the integrity modules.
import type { Finding } from '#types/finding.ts';

export type IntegrityCheck = (input: EngineInput) => Promise<Finding[]>;

/** A fenced code block as the fences check reads it. */
export type FencedBlock = { line: number; language: string; body: string };

/** A fence being read, until its closing line. */
export type OpenFence = { ticks: string; language: string; line: number; body: string[] };

/** Where a Markdown reader is: inside a fence, and whether that fence holds free text. */
export type FenceState = { ticks: string; isFreeText: boolean };

/** One line of Markdown outside code, with its number. */
export type ProseLine = { number: number; line: string };

/** What the stale-paths check resolves tokens against. */
export type PathIndex = { known: Set<string>; tasks: Set<string>; isException: (path: string) => boolean };

/** One README shape problem: line, rule, message. */
export type ShapeProblem = [number, string, string];

export type Tsconfig = { extends?: string | string[]; compilerOptions?: Record<string, unknown> };

/** One environment variable read in code: the key and the line it is read on. */
export type EnvRead = { key: string; line: number };

/** A tool's own suppressions file: its path from the root and the scope it belongs to (the root, until a tool runs per scope). */
export type SuppressionFile = { path: string; scope: string };

/** A path pattern the policy holds and where it sits. */
export type PathPattern = { pattern: string; where: string };

/** One inline suppression form: its name, the directive that marks it, how a reason is written after it, and whether it is refused outright. */
export type SuppressionForm = { form: string; marker: RegExp; reason: RegExp; isForbidden?: boolean };

/** One finding as gitleaks writes it into a report or a baseline. */
export type GitleaksFinding = { Fingerprint: string; File: string; RuleID: string; Commit?: string };

/** The reason for one reviewed baseline entry. */
export type BaselineReason = { fingerprint: string; reason: string };

/** The keys of a package.json the manifest policy reads. */
export type PackageManifest = {
    private?: boolean;
    packageManager?: string;
    workspaces?: unknown;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
};

/** What the npm license checker prints: one entry for each installed package, by name and version. */
export type LicenseReport = Record<string, { licenses?: string | string[] }>;

/** One package accepted under a license outside the allowed list. */
export type LicenseException = { package: string; license: string; reason: string };

/** Builds one finding of a check from the file, the rule and the text. */
export type Reporter = (file: string, rule: string, text: string) => Finding;

/** One CodeQL result the policy accepts: the rule id, where, and why. */
export type AcceptedResult = { rule: string; paths: string[]; reason: string };

/** One result of a SARIF log, with the fields the CodeQL check reads. */
export type SarifResult = {
    ruleId?: string;
    message?: { text?: string };
    locations?: { physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number } } }[];
};

/** The part of a SARIF log the CodeQL check reads. */
export type SarifLog = { runs?: { results?: SarifResult[] }[] };

/** One side of a clone in a jscpd report. */
export type ClonePlace = { name: string; start: number; end: number };

/** The part of a jscpd report the duplication check reads. */
export type CloneReport = {
    statistics?: { total?: { percentage?: number } };
    duplicates?: { lines: number; firstFile: ClonePlace; secondFile: ClonePlace }[];
};
