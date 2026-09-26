import { expect, test } from 'bun:test';
import { acquisitionNote } from '#cli/tools/packages/acquisition.ts';

test.each([
    'error: Request to https://api.github.com/repos/editorconfig-checker/editorconfig-checker/releases/tags/v3.4.0 failed with status 403',
    'Error: HTTP 403 from https://github.com/editorconfig-checker/editorconfig-checker/releases/download/v3.4.0/ec-darwin-arm64.tar.gz',
    'API rate limit exceeded for 203.0.113.9.',
])('output that shows a GitHub refusal names the token to set: %s', (line) => {
    expect(acquisitionNote(`postinstall failed\n${line}\n`)).toContain('GITHUB_TOKEN');
});

test('output without a known cause adds no note', () => {
    expect(acquisitionNote('error: package "left-pad@0.0.1" not found\n')).toBeUndefined();
    expect(acquisitionNote('')).toBeUndefined();
});
