import { basename } from 'node:path/posix';

import { PACKAGE_JSON_PATTERN, PRIVATE_PIN_OPTIONS } from '#cli/config/configurations/javascript/blocks.ts';
import {
    PACKAGE_JSON_RULES,
    PIN_RANGES_RULE,
    ROOT_PACKAGE_JSON_RULES,
} from '#cli/config/configurations/javascript/rules.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { readPackageJson } from '#cli/parsers/projects/dependencies.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { escapeGlob } from '#cli/system/patterns.ts';
import type { ConfigurationBlocks, PlannedEslintFile } from '#cli/types/configurations/javascript.ts';

export function buildPackageJsonBlocks(planned: Pick<PlannedEslintFile, 'session'>): ConfigurationBlocks {
    const { session } = planned;
    const privatePackages = session.repository.files
        .filter(
            (file) =>
                file.kind === 'source' &&
                basename(file.path) === PACKAGE_JSON &&
                tryParseFile(() => readPackageJson(session.cache, file.path))?.['private'] === true,
        )
        .map((file) => escapeGlob(file.path));
    return [
        {
            fields: {
                files: [PACKAGE_JSON_PATTERN],
                rules: PACKAGE_JSON_RULES,
            },
        },
        ...(privatePackages.length === 0
            ? []
            : [{ fields: { files: privatePackages, rules: { [PIN_RANGES_RULE]: ['error', PRIVATE_PIN_OPTIONS] } } }]),
        { fields: { files: [PACKAGE_JSON], rules: ROOT_PACKAGE_JSON_RULES } },
    ];
}
