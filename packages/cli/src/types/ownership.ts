import type { JsonValue } from '#cli/types/shapes.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';

/** One locked repository writer. */
export type Writer = { files: Files; [Symbol.dispose](): void };

export type ManagedKeys = { path: string; keys: { key: KeyPath; value: JsonValue | undefined }[] };

export type ReplacementRequest = {
    path: string;
    next: FileContents;
    expected?: FileContents | undefined;
};

/** New bytes or a removal, with the file contents expected on disk. */
export type WritePlan = {
    path: string;
    before: FileContents | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    after?: FileContents;
};
