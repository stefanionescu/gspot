import { test, expect } from 'bun:test';
import { parseGitleaksBaseline } from '#cli/parsers/gitleaks.ts';
import { INVALID_BASELINES } from '#tests/config/cli/parsers/gitleaks.ts';

for (const [index, text] of INVALID_BASELINES.entries())
    test(`malformed baseline case ${String(index + 1)} reports its required shape without secret bytes`, () => {
        expect(() => parseGitleaksBaseline(text)).toThrow(
            /^Cannot read \.gspot\/gitleaks-baseline\.json\. Use a JSON array of records with nonempty Fingerprint and File strings and an optional Commit string\.$/u,
        );
    });

test('native baseline reports retain consumed fields and discard secret bytes', () => {
    const text =
        '[{"Fingerprint":"old.py:rule:1","File":"old.py","Commit":"","RuleID":"rule","Secret":"sensitive-baseline-value"},{"Fingerprint":"commit:gone.md:rule:4","File":"gone.md","Commit":"commit"}]';
    expect(parseGitleaksBaseline(text)).toStrictEqual([
        { Fingerprint: 'old.py:rule:1', File: 'old.py', Commit: '' },
        { Fingerprint: 'commit:gone.md:rule:4', File: 'gone.md', Commit: 'commit' },
    ]);
    expect(parseGitleaksBaseline('[]')).toStrictEqual([]);
});
