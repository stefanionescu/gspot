// Defects and corrections exercised by the installed language-tool consumer.
import type { PackageCheckCase } from '#tests/types/packages/check-case.ts';

export const PROSE_CHECK: PackageCheckCase = {
    only: 'prose/vale',
    path: 'guide.md',
    defect: '# Schedule\n\nNebulaConfiguration uses TypeScript. Release on 03/04/2026.\n',
    corrected: '# Schedule\n\nNebulaConfiguration uses TypeScript. Release on March 4, 2026.\n',
    findings: [{ line: 3, rule: 'gspot.dates' }],
};

export const PYTHON_CHECK: PackageCheckCase = {
    only: 'python/ruff',
    path: 'entry.py',
    defect: 'answer = missing_name\n',
    corrected: 'answer = "example"\n',
    findings: [{ line: 1, rule: 'F821' }],
};

export const BASH_CHECK: PackageCheckCase = {
    only: 'bash/shellcheck',
    path: 'broken.sh',
    defect: '#!/usr/bin/env bash\nprintf "%s\\n" $1\n',
    corrected: '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n',
    findings: [{ line: 2, rule: 'SC2086' }],
};

export const SWIFT_CHECK: PackageCheckCase = {
    only: 'naming/identifiers',
    path: 'Account.swift',
    defect: 'let utils = 1\n',
    corrected: 'let account = 1\n',
    findings: [{ line: 1, rule: 'banned-term' }],
};
