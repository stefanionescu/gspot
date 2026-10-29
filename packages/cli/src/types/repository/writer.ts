import type { JsonValue } from '#cli/types/shapes.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

export type WritePlan = {
    path: string;
    before: FileContents | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    after?: FileContents;
};

export type ReplacementRequest = {
    path: string;
    next: FileContents;
    expected?: FileContents | undefined;
};

export type ManagedKeys = { path: string; keys: { key: KeyPath; value: JsonValue | undefined }[] };
