import { stringify } from 'yaml';
import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { dirname, relative } from 'node:path/posix';
import type { Session } from '#cli/types/session.ts';
import { buildValeIni } from '#cli/installers/vale.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { VALE_PACKAGES, VALE_PACKAGE_URLS } from '#cli/config/installers/installers.ts';

import {
    ACRONYMS,
    ACRONYM_NAME,
    LENGTH_STYLES,
    ACRONYM_MESSAGE,
    ACRONYM_PATTERN,
    BANNED_HEADINGS,
    VALE_STYLES_PATH,
    VALE_REGEX_SYMBOLS,
    CAPITALIZATION_STYLES,
    BANNED_HEADING_MESSAGE,
    ACRONYM_DEFINITION_PATTERN,
} from '#cli/config/generation/configurations/general.ts';

function listExceptions(words: string[]): string[] {
    return [...new Set([...words, ...ACRONYMS])]
        .toSorted(compareText)
        .map((word) => word.replaceAll(VALE_REGEX_SYMBOLS, (symbol) => '\\' + symbol));
}

/**
Build the title or heading capitalization rule with the accepted vocabulary.

@param planned the generated config file and scope.
@param name whether to check heading or title case.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIG_BUILDERS builds heading-case.yml and title-case.yml through it, one call per case style.
export function buildCapitalizationStyle(planned: PlannedConfig, name: keyof typeof CAPITALIZATION_STYLES): string {
    return stringify({
        ...CAPITALIZATION_STYLES[name],
        extends: 'capitalization',
        level: 'error',
        exceptions: listExceptions(listAllowedWords(planned.session)),
    });
}

/**
Build the `acronyms` style of Vale: the Vale acronym rule with the allowed acronyms.

@param planned the config file to build.
*/
export function buildAcronymsStyle(planned: PlannedConfig): string {
    const words = listAllowedWords(planned.session);

    return stringify({
        extends: 'conditional',
        message: ACRONYM_MESSAGE,
        level: 'error',
        ignorecase: false,
        first: ACRONYM_PATTERN,
        second: ACRONYM_DEFINITION_PATTERN,
        exceptions: listExceptions(words).filter((word) => ACRONYM_NAME.test(word)),
    });
}

/**
Build vale.ini: the Vale style locations and rule levels for the prose checks.

@param planned the config file to build.
*/
export function buildValeIniFile(planned: PlannedConfig): string {
    const folders = planned.level === 'all' ? [VALE_STYLES_PATH, GSPOT_PATHS.valePackages] : [VALE_STYLES_PATH];
    return buildValeIni({
        level: planned.level,
        stylesPaths: folders.map((path) => relative(dirname(planned.targetPath), path)),
        packages: VALE_PACKAGES.map((name) => VALE_PACKAGE_URLS[name]),
    });
}

/**
Build the `banned-headings` style of Vale: the Vale rule for the banned headings.

@param planned the config file to build.
*/
export function buildBannedHeadingsStyle(planned: PlannedConfig): string {
    const headings = [...new Set([...BANNED_HEADINGS, ...getTable(planned.scope.settings, 'prose').banned_headings])];
    return stringify({
        extends: 'existence',
        message: BANNED_HEADING_MESSAGE,
        level: 'error',
        ignorecase: true,
        scope: 'heading',
        nonword: true,
        tokens: headings.map(
            (heading) =>
                String.raw`(?:\b|^)${heading.replaceAll(VALE_REGEX_SYMBOLS, (symbol) => '\\' + symbol)}(?:\b|$)`,
        ),
    });
}

/**
Build a prose length rule with its configured ceiling.

@param planned the generated config file and scope.
@param name the prose unit that the rule limits.
*/
export function buildLengthStyle(planned: PlannedConfig, name: keyof typeof LENGTH_STYLES): string {
    const { setting, message, ...style } = LENGTH_STYLES[name];
    const max = getTable(planned.scope.settings, 'prose')[setting];
    return stringify({ ...style, message: message.replace('{{max}}', () => String(max)), level: 'error', max });
}

/**
Build the accepted words of Vale: the accepted product names and your own allowed words, one per line.

@param planned the config file to build.
*/
export function buildAcceptedWordsFile(planned: PlannedConfig): string {
    const words = listAllowedWords(planned.session);

    return words.toSorted((left, right) => compareText(left, right)).join('\n');
}

function listAllowedWords(session: Session): string[] {
    const products = session.scopes.flatMap(({ configurations }) =>
        configurations.flatMap((configuration) => [
            ...configuration.tools.map((tool) => tool.name),
            ...configuration.allowed_words,
        ]),
    );
    const words = session.scopes.flatMap((scope) => Object.keys(getTable(scope.settings, 'spelling').allowed_words));
    return [...new Set([...products, ...words])];
}
