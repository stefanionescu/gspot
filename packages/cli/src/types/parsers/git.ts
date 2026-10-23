import type { GIT_MODES } from '#cli/config/parsers/git.ts';

export type GitFile = { mode: (typeof GIT_MODES)[number]; hash: string; path: string };

export type GitIndexFile = GitFile & { stage: number };

export type GitStream = { chunks: AsyncIterator<Buffer>; chunk: Buffer; cursor: number };

export type AttributePattern = { pattern: string; attributes: string[] };
