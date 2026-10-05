/** One Markdown heading's source range, depth, and all-level marker. */
export type RuleSection = { start: number; end: number; depth: number; all: boolean };

/** The body and opening line of a language-tagged Markdown code fence. */
export type FencedBlock = { line: number; language: string; body: string };

/** One canonical syntax reader selected by the declared fence aliases. */
export type FenceParser = 'typescript' | 'tsx' | 'javascript' | 'bash' | 'python' | 'json' | 'jsonc' | 'toml' | 'yaml';

/** A syntax diagnostic at a one-based line of a code body or Markdown source. */
export type FenceSyntaxProblem = { line: number; message: string };

/** A required syntax reader, with native Bash execution supplied by the check owner. */
export type FenceSyntaxReader = (
    body: string,
) => FenceSyntaxProblem | undefined | Promise<FenceSyntaxProblem | undefined>;
