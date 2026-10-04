import { test, expect } from 'bun:test';
import { parseCommand } from '#cli/parsers/command.ts';

test('configured commands preserve quoted paths and empty arguments while refusing shell operators', () => {
    expect(parseCommand(`bun "scripts/build site.js" "" 'two words'`)).toStrictEqual([
        'bun',
        'scripts/build site.js',
        '',
        'two words',
    ]);
    expect(() => parseCommand('bun script.js && echo done')).toThrow(
        'must be one executable with literal arguments: no pipes, &&, redirection, or variables.',
    );
});

test('configured commands decode an escaped space as one literal argument', () => {
    expect(parseCommand(String.raw`bun two\ words`)).toStrictEqual(['bun', 'two words']);
});
