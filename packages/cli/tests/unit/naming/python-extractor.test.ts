import { describe, expect, test } from 'bun:test';
import { identifiersOf } from '#cli/naming/extract.ts';

const SOURCE = `"""Orders."""

MAX_ITEMS = 3
default_name = "x"

type OrderId = int


class OrderError(ValueError):
    """Raised for a bad order."""


class Order_Book:
    """Holds orders."""

    limit = 10

    def __init__(self, owner: str, *extra: int, **flags: bool) -> None:
        self.owner = owner

    def addItem(self, item_name: str = "a", count=1) -> None:
        local_total = count


def make_order(name, /, size: int) -> None:
    """Make one."""
`;

describe('pythonIdentifiers', () => {
    test('every declared name arrives with its category, and dunder names and self stay out', async () => {
        const found = await identifiersOf('shop/orders.py', SOURCE, 'python');
        const names = (category: string): string[] =>
            found.filter((entry) => entry.category === category).map((entry) => entry.name);
        expect(names('constants')).toEqual(['MAX_ITEMS']);
        expect(names('variables')).toEqual(['default_name', 'local_total']);
        expect(names('type_aliases')).toEqual(['OrderId']);
        expect(names('exceptions')).toEqual(['OrderError']);
        expect(names('classes')).toEqual(['Order_Book']);
        expect(names('attributes')).toEqual(['limit']);
        expect(names('methods')).toEqual(['addItem']);
        expect(names('functions')).toEqual(['make_order']);
        expect(names('parameters')).toEqual(['owner', 'extra', 'flags', 'item_name', 'count', 'name', 'size']);
    });
});
