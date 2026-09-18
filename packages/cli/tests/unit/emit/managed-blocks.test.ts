import { describe, expect, test } from 'bun:test';
import { currentBlock, applyBlock, withoutBlock } from '#cli/emit/managed-blocks.ts';

describe('managed blocks', () => {
    test('are appended first, replaced in place, and removed cleanly', () => {
        const first = applyBlock('# Mine\n\ntext\n', 'block one', 'markdown');
        expect(first).toContain('# Mine');
        expect(currentBlock(first, 'markdown')).toBe('block one');
        const second = applyBlock(first, 'block two', 'markdown');
        expect(second.match(/gspot managed >>>/g)).toHaveLength(1);
        expect(currentBlock(second, 'markdown')).toBe('block two');
        expect(withoutBlock(second, 'markdown')).toBe('# Mine\n\ntext\n');
        expect(applyBlock(second, 'block two', 'markdown')).toBe(second);
    });
});
