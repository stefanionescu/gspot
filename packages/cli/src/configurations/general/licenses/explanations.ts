import type { LintRuleDocs } from '#cli/types/tools.ts';
import { LICENSE_RULES } from '#cli/config/configurations/general.ts';

export const LICENSE_RULE_DOCS = {
    [LICENSE_RULES.disallowedLicense]: {
        description: 'Each locked package reports a license that `licenses.allowed` lists.',
        why: 'A license outside the list can bind the project to terms that the team did not accept.',
        fix: 'Replace the package, allow its license, or accept the package in a `[[licenses.allowed_package]]` record.',
        example: 'A package under `AGPL-3.0` while `licenses.allowed` lists `MIT` reports `disallowed-license`.',
    },
    [LICENSE_RULES.unusedRecord]: {
        description: 'Each `[[licenses.allowed_package]]` record matches a locked package.',
        why: 'A record that matches nothing stays in `gspot.toml` after its package is gone.',
        fix: 'Delete the record, or fix the package name or version range that it gives.',
        example: 'A record for `left-pad` after the lockfile drops `left-pad` reports `unused-record`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
