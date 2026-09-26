import { describe, expect, test } from 'bun:test';
import { identifiersOf } from '#cli/checks/naming/extract.ts';
import { PYTHON_EXTRACTOR_SOURCE } from '#tests/constants/unit/cli/checks/naming.ts';

describe('pythonIdentifiers', () => {
    test('every declared name arrives with its category, and dunder names and self stay out', async () => {
        const found = await identifiersOf('shop/orders.py', PYTHON_EXTRACTOR_SOURCE, 'python');
        const names = (category: string): string[] =>
            found.filter((entry) => entry.category === category).map((entry) => entry.name);
        expect(names('constants')).toStrictEqual(['MAX_ITEMS']);
        expect(names('variables')).toStrictEqual(['default_name', 'local_total']);
        expect(names('type_aliases')).toStrictEqual(['OrderId']);
        expect(names('exceptions')).toStrictEqual(['OrderError']);
        expect(names('classes')).toStrictEqual(['Order_Book']);
        expect(names('attributes')).toStrictEqual(['limit']);
        expect(names('methods')).toStrictEqual(['addItem']);
        expect(names('functions')).toStrictEqual(['make_order']);
        expect(names('parameters')).toStrictEqual(['owner', 'extra', 'flags', 'item_name', 'count', 'name', 'size']);
    });
});
