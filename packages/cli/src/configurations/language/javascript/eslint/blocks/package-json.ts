import { basename } from 'node:path/posix';
import { escapeGlob } from '#cli/system/patterns.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { readPackageJson } from '#cli/parsers/projects/dependencies.ts';
import type { PlannedEslintFile, ConfigurationBlocks } from '#cli/types/configurations/javascript.ts';
import { PRIVATE_PIN_OPTIONS, PACKAGE_JSON_PATTERN } from '#cli/config/configurations/javascript/blocks.ts';

import {
    PIN_RANGES_RULE,
    PACKAGE_JSON_RULES,
    ROOT_PACKAGE_JSON_RULES,
} from '#cli/config/configurations/javascript/rules.ts';

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
