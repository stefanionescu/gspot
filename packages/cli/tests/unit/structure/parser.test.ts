import { describe, expect, test } from 'bun:test';
import { scriptFunctions } from '#cli/structure/parser.ts';
import { codeLines, withoutComment } from '#cli/structure/code-lines.ts';

describe('shell parsing', () => {
    test('comments are stripped with quotes respected', () => {
        expect(withoutComment('echo "a # b" # c')).toBe('echo "a # b" ');
        expect(withoutComment("printf '#'")).toBe("printf '#'");
        expect(withoutComment(String.raw`x=1 \# y`)).toBe(String.raw`x=1 \# y`);
        expect(codeLines(['', '# note', 'a=1 # b', '  '])).toEqual([{ number: 3, code: 'a=1' }]);
    });

    test('functions carry their range and body', async () => {
        const found = await scriptFunctions(
            '#!/usr/bin/env bash\n_one() {\n    echo 1\n}\n\nmain() {\n    _one "$@"\n}\n',
        );
        expect(found).toEqual([
            { name: '_one', start: 2, end: 4, body: ['    echo 1'] },
            { name: 'main', start: 6, end: 8, body: ['    _one "$@"'] },
        ]);
    });
});
