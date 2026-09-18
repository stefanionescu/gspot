// Type aliases of the rules modules.

export type RuleFile = { source: string; target: string; layer: string; preset: string; title: string };

/** The front matter of a corpus file. */
export type FrontMatter = { layer: string; preset: string; title: string; fields: Record<string, string> };

/** One thing the corpus lint found: the file relative to rules/, the one-based line, and what is wrong. */
export type RuleFinding = { file: string; line: number; message: string };

/** The marker at the end of a statement: the check that enforces it, or unenforced. */
export type Marker = { kind: 'enforced' | 'unenforced'; check?: string };

/** A rule statement: its first and last line index (zero-based), its text without the marker, and its marker. */
export type Statement = { start: number; end: number; text: string; marker: Marker | undefined };

/** How many statements a file holds and how many carry no enforcement. */
export type MarkerCounts = { statements: number; unenforced: number };

/** A corpus file by its path relative to rules/. */
export type RuleText = { path: string; text: string };

/** What the corpus lint needs besides the files. */
export type RulesLintOptions = {
    checkIds: ReadonlySet<string>;
    presetIds: ReadonlySet<string>;
    vale?: { binary: string; config: string };
};

/** The corpus lint's result. */
export type RulesLintReport = { findings: RuleFinding[]; files: number; counts: MarkerCounts; isValeRun: boolean };

/** One row of enforcement-map.json: the files it applies to, the statement pattern, and the check that enforces the match. */
export type EnforcementMapping = { files: string; pattern: string; check: string };

/** The state of a walk over a file's fenced blocks. */
export type FenceWalk = {
    file: string;
    findings: RuleFinding[];
    open: { ticks: string; line: number } | undefined;
    onProse: (line: string, number: number) => void;
};
