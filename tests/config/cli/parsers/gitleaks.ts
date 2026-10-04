/** Invalid shapes include secret-bearing unknown fields to verify safe diagnostics. */
export const INVALID_BASELINES = [
    'not json',
    'null',
    '{}',
    '[null]',
    '[{}]',
    '[{"File":"old.py"}]',
    '[{"Fingerprint":"old.py:rule:1"}]',
    '[{"Fingerprint":"","File":"old.py"}]',
    '[{"Fingerprint":"old.py:rule:1","File":4}]',
    '[{"Fingerprint":"old.py:rule:1","File":"old.py","Commit":null}]',
    '[{"Fingerprint":"old.py:rule:1","File":"old.py","Commit":4}]',
    '[{"Secret":"sensitive-baseline-value"',
    '[{"Fingerprint":4,"File":"old.py","Secret":"sensitive-baseline-value"}]',
];
