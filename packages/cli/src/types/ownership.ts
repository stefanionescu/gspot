import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { Files, FileCopy } from '#cli/types/system/files.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

/** One locked repository writer. */
export type Writer = { files: Files; [Symbol.dispose](): void };

export type FileEdit = { path: string; changes: { path: KeyPath; value: JsonValue }[] };

export type ReplacementRequest = {
    path: string;
    next: FileCopy;
    canReplace?: boolean | undefined;
    expected?: FileCopy | undefined;
};

export type KeyChangeRequest = { path: string; changes: FileEdit['changes']; current: FileCopy | undefined };
export type KeyChangePlan = { next: FileCopy; status: 'changed' | 'unchanged' };

/** Proposed bytes or removal, with the expected current copy on disk. */
export type WritePlan = {
    path: string;
    before: FileCopy | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    after?: FileCopy;
};
