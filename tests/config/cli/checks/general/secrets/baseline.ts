export const BASELINE =
    '[{"Fingerprint":"old.py:aws-access-token:1","File":"old.py","RuleID":"aws-access-token"},{"Fingerprint":"abc123:gone.md:generic-api-key:4","File":"gone.md","RuleID":"generic-api-key","Commit":"abc123"}]';

export const BASELINE_REASONS =
    '[[tools.gitleaks.baseline_reasons]]\nfingerprint = "old.py:aws-access-token:1"\nreason = "An inert documented example."\n[[tools.gitleaks.baseline_reasons]]\nfingerprint = "abc123:gone.md:generic-api-key:4"\nreason = "An inert example retained in history."\n';
