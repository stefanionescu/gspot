import { test, expect, describe } from 'bun:test';
import { scriptFunctions } from '#cli/checks/language/bash/scripts.ts';
import { codeLines, withoutComment } from '#cli/checks/language/bash/code-lines.ts';

describe('shell parsing', () => {
    test('comments are stripped with quotes respected', () => {
        expect(withoutComment('echo "a # b" # c')).toBe('echo "a # b" ');
        expect(withoutComment("printf '#'")).toBe("printf '#'");
        expect(withoutComment(String.raw`x=1 \# y`)).toBe(String.raw`x=1 \# y`);
        expect(codeLines(['', '# note', 'a=1 # b', '  '])).toStrictEqual([{ number: 3, code: 'a=1' }]);
    });

    test('functions keep their range and body', async () => {
        const found = await scriptFunctions(
            '#!/usr/bin/env bash\n_one() {\n    echo 1\n}\n\nmain() {\n    _one "$@"\n}\n',
        );
        expect(found).toStrictEqual([
            { name: '_one', start: 2, end: 4, body: ['    echo 1'], statements: 1 },
            { name: 'main', start: 6, end: 8, body: ['    _one "$@"'], statements: 1 },
        ]);
    });
});
