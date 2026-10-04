import type { BlockStyle, BlockMarkers } from '#cli/types/platform/managed-blocks.ts';

export const HASH_BLOCK_END = '# <<< gspot managed <<<';

export const HASH_BLOCK_START = '# >>> gspot managed >>>';

export const MANAGED_BLOCK_END = '<!-- <<< gspot managed <<< -->';

export const MANAGED_BLOCK_START = '<!-- >>> gspot managed >>> -->';

export const MARKERS: Record<BlockStyle, BlockMarkers> = {
    markdown: { start: MANAGED_BLOCK_START, end: MANAGED_BLOCK_END },
    hash: { start: HASH_BLOCK_START, end: HASH_BLOCK_END },
};

/** Comment syntax supported by managed instruction blocks. */
export const BLOCK_STYLES = ['markdown', 'hash'] as const;
