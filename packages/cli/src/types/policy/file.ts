import type { FileCopy } from '#cli/types/platform/root.ts';

/** Native policy bytes and their captured identity, published through the caller's ownership transaction. */
export type PolicyWriteRequest = {
    text: string;
    original: FileCopy | undefined;
    publish: (next: FileCopy, expected: FileCopy | undefined) => void;
};
