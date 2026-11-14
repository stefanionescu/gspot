import { test, expect } from 'bun:test';
import { joinTables } from '#cli/system/tables.ts';

test('joinTables refuses a key that two tables hold', () => {
    expect(joinTables([{ first: 1 }, { second: 2 }])).toStrictEqual({ first: 1, second: 2 });
    expect(() => joinTables([{ first: 1 }, { first: 2 }])).toThrow('Two registry tables hold first.');
});
