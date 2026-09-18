// Type aliases of the rules modules.

export type RuleFile = { source: string; target: string; layer: string; preset: string; title: string };

/** The front matter of a corpus file. */
export type FrontMatter = { layer: string; preset: string; title: string; fields: Record<string, string> };

/** One thing the corpus lint found: the file relative to rules/, the one-based line, and what is wrong. */
export type RuleFinding = { file: string; line: number; message: string };

/** A corpus file by its path relative to rules/. */
export type RuleText = { path: string; text: string };

/** What the corpus lint needs besides the files. */
export type RulesLintOptions = {
    vale?: { binary: string; config: string };
};

/** The corpus lint's result. */
export type RulesLintReport = { findings: RuleFinding[]; files: number; isValeRun: boolean };

/** The state of a walk over a file's fenced blocks. */
export type FenceWalk = {
    file: string;
    findings: RuleFinding[];
    open: { ticks: string; line: number } | undefined;
    onProse: (line: string, number: number) => void;
};
