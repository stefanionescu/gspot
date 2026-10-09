// Samples and fixes exercised by the installed language-tool consumer.
import type { PackageCheckCase } from '#tests/types/harness/consumer.ts';

export const PROSE_CHECK: PackageCheckCase = {
    only: 'prose/vale',
    path: 'guide.md',
    sample: '# Schedule\n\nNebulaConfiguration uses Python. Release on 03/04/2026.\n',
    corrected: '# Schedule\n\nNebulaConfiguration uses Python. Release on March 4, 2026.\n',
    findings: [{ line: 3, rule: 'gspot.dates' }],
};

export const SWIFT_CHECK: PackageCheckCase = {
    only: 'naming/identifiers',
    path: 'Account.swift',
    sample: 'let utils = 1\n',
    corrected: 'let account = 1\n',
    findings: [{ line: 1, rule: 'banned-term' }],
};
