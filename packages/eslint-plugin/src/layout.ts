import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Consecutive statements the predicate accepts, as runs.
 * @param body the program statements
 * @param accepts whether a statement belongs to the block
 * @returns each uninterrupted run
 */
export function runsOf(
    body: TSESTree.Statement[],
    accepts: (statement: TSESTree.Statement) => boolean,
): TSESTree.Statement[][] {
    const runs: TSESTree.Statement[][] = [];
    let isOpen = false;
    for (const statement of body) {
        const isMember = accepts(statement);
        if (isMember && !isOpen) runs.push([]);
        if (isMember) runs.at(-1)?.push(statement);
        isOpen = isMember;
    }
    return runs;
}
