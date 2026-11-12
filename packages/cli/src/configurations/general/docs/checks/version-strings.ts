import { posix } from 'node:path';

import { CHANGELOG_FILE, DOCS_RULES, VERSION_STRING_MESSAGE } from '#cli/config/configurations/docs.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { listOwnFiles } from '#cli/repository/scopes.ts';
import { pyprojectSchema } from '#cli/schemas/parsers.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { readText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { escapeRegExp, listMatchingLines } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function listScopeVersions(session: Session, scopePath: string): string[] {
    return listOwnFiles(session.repository.files, session.scopes, scopePath)
        .filter(({ kind }) => kind === 'source')
        .flatMap(({ path }) => {
            const name = posix.basename(path);
            if (name === PACKAGE_JSON) return [tryParseFile(() => readPackageJson(session.cache, path))?.version];
            return name === PYPROJECT_TOML
                ? [
                      tryParseFile(() => parseTomlFile(path, readText(session.cache, path), pyprojectSchema))?.project
                          ?.version,
                  ]
                : [];
        })
        .filter((version): version is string => typeof version === 'string');
}

function checkVersionStrings(session: Session, planned: PlannedCheck): CheckFinding[] {
    const versions = listScopeVersions(session, planned.scope.path);
    if (versions.length === 0) return [];
    const copied = new RegExp(
        String.raw`(?<![\w.])(?:${versions.map((version) => escapeRegExp(version)).join('|')})(?![\w.])`,
        'u',
    );
    const isTest = buildPathMatcher(planned.scope.settings.test_files);
    return planned.files
        .filter(({ kind }) => kind === 'source')
        .filter(({ path, tags }) => (tags.includes('markdown') || isTest(path)) && !CHANGELOG_FILE.test(path))
        .flatMap(({ path }) =>
            listMatchingLines(readText(session.cache, path), (text) => copied.test(text)).map((line) => ({
                file: path,
                line,
                rule: DOCS_RULES.versionString,
                message: VERSION_STRING_MESSAGE,
            })),
        );
}

export const DOCS_VERSION_STRINGS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docs/version-strings': { check: checkVersionStrings },
};
