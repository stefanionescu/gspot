import type { EngineInput } from '#types/run.ts';
// Type aliases of the integrity modules.
import type { Finding } from '#types/finding.ts';

export type IntegrityCheck = (input: EngineInput) => Promise<Finding[]>;

/** A fenced code block as the fences check reads it. */
export type FencedBlock = { line: number; language: string; body: string };

/** One line of Markdown outside code, with its number. */
export type ProseLine = { number: number; line: string };

/** What the stale-paths check resolves tokens against. */
export type PathIndex = { known: Set<string>; tasks: Set<string>; isException: (path: string) => boolean };

/** One README shape problem: line, rule, message. */
export type ShapeProblem = [number, string, string];

/** One environment variable read in code: the key and the line it is read on. */
export type EnvRead = { key: string; line: number };

/** A path pattern the policy holds and where it sits. */
export type PathPattern = { pattern: string; where: string };

/** One suppression observed in a source comment through the selected tool definitions. */
export type SuppressionComment = { file: string; line: number; form: string; reason?: string; forbidden: boolean };

/** One finding as gitleaks writes it into a report or a baseline. */
export type GitleaksFinding = { Fingerprint: string; File: string; RuleID: string; Commit?: string };

/** The reason for one reviewed baseline entry. */
export type BaselineReason = { fingerprint: string; reason: string };

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
