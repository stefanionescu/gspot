import { expect, test } from 'bun:test';

import { findBlockBody, findBlockSpan, replaceBlock } from '#cli/parsers/formats/managed-blocks.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { BLOCK_FORMATS, MALFORMED_BLOCKS } from '#tests/config/parsers/formats.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a managed block is appended and replaced without changing your own text', () => {
    const first = replaceBlock('# Mine\n\ntext\n', 'block one', { path: 'AGENTS.md' });
    expect(findBlockBody(first, { path: 'AGENTS.md' })).toBe('block one');
    const second = replaceBlock(first, 'block two', { path: 'AGENTS.md' });
    expect(findBlockBody(second, { path: 'AGENTS.md' })).toBe('block two');
    expect(second).toStartWith('# Mine\n\ntext\n\n');
    expect(replaceBlock(second, 'block two', { path: 'AGENTS.md' })).toBe(second);
});

test('a new block goes first in .gitattributes, so the rules of the repository keep winning', async () => {
    const text = replaceBlock('*.bat text eol=crlf\n', '* text=auto eol=lf', { path: '.gitattributes' });
    await using sandbox = await createGitSandbox({ '.gitattributes': text });
    expect(runGitStep(sandbox.path, ['check-attr', 'eol', 'run.bat'])).toBe('run.bat: eol: crlf');
    expect(runGitStep(sandbox.path, ['check-attr', 'eol', 'run.sh'])).toBe('run.sh: eol: lf');
});

test.each([...MALFORMED_BLOCKS])('every block operation refuses malformed markers in $path: $source', (context) => {
    const { source, path } = context;
    const refusal = matchFields<GspotError>({
        name: 'GspotError',
        code: 'filesystem',
        message: expect.stringContaining(path) as string,
    });
    expect(() => findBlockSpan(source, context)).toThrow(refusal);
});

test.each([...BLOCK_FORMATS])('block readers keep your own text in $path', (context) => {
    expect(findBlockSpan('authored text', context)).toBeUndefined();
    const source = `before\n${context.start}\n  instructions  \n${context.end}\nafter`;
    expect(findBlockBody(source, context)).toBe('instructions');
    const replaced = replaceBlock(source, 'replacement', context);
    expect(replaced).toStartWith('before\n');
    expect(replaced).toEndWith('after');
    expect(findBlockBody(replaced, context)).toBe('replacement');
});
