import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';

/** One locked repository writer. */
export type Writer = { files: Files; [Symbol.dispose](): void };

export type FileEdit = { path: string; changes: { path: KeyPath; value: JsonValue | undefined }[] };

export type ReplacementRequest = {
    path: string;
    next: FileContents;
    canReplace?: boolean | undefined;
    expected?: FileContents | undefined;
};

export type KeyChangeRequest = { path: string; changes: FileEdit['changes']; current: FileContents | undefined };
export type KeyChangePlan = { next: FileContents; status: 'changed' | 'unchanged' };

/** Proposed bytes or removal, with the expected current copy on disk. */
export type WritePlan = {
    path: string;
    before: FileContents | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    after?: FileContents;
};
