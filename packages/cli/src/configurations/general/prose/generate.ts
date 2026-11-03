import { stringify } from 'yaml';
import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/tools.ts';
import { dirname, relative } from 'node:path/posix';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

import {
    ACRONYMS,
    ACRONYM_NAME,
    LENGTH_STYLES,
    ACRONYM_MESSAGE,
    ACRONYM_PATTERN,
    BANNED_HEADINGS,
    FILE_NAME_PATTERN,
    VALE_REGEX_SYMBOLS,
    HEADING_CASE_STYLE,
    BANNED_HEADING_MESSAGE,
    ACRONYM_DEFINITION_PATTERN,
} from '#cli/config/configurations/prose.ts';
import {
    VOCAB_LINE,
    VALE_PACKAGES,
    BLOCK_IGNORES,
    TOKEN_IGNORES,
    PROSE_GRAMMARS,
    MIN_ALERT_LINE,
    NO_STYLES_LINE,
    VALE_OFF_RULES,
    VALE_STYLES_PATH,
    VALE_PACKAGE_URLS,
    ALL_FILES_SECTION,
    VALE_MARKUP_RULES,
    VALE_MARKUP_FILES,
    VALE_COMMENT_RULES,
    STYLES_PATH_COMMENT,
    VALE_SKIPPED_SCOPES,
    MARKUP_RULES_COMMENT,
} from '#cli/config/tools/vale.ts';

function listExceptions(words: string[]): string[] {
    return [...new Set([...words, ...ACRONYMS])]
        .toSorted(compareText)
        .map((word) => word.replaceAll(VALE_REGEX_SYMBOLS, (symbol) => '\\' + symbol));
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

/**
Build the `heading-case` style of Vale: sentence case for titles and headings, except for the accepted vocabulary and
file names. A file name is code, and a front matter title cannot format it as code.

@param planned the generated config file and scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIG_BUILDERS selects the generator of heading-case.yml through its shared builder interface.
export function buildHeadingCaseStyle(planned: PlannedConfig): string {
    return stringify({
        ...HEADING_CASE_STYLE,
        extends: 'capitalization',
        level: 'error',
        exceptions: [...listExceptions(listAllowedWords(planned.session)), FILE_NAME_PATTERN],
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
    const formats = Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
        'format' in grammar ? [[extension.slice(1), grammar.format] as const] : [],
    );
    const lines = [
        STYLES_PATH_COMMENT,
        ...[VALE_STYLES_PATH, GSPOT_PATHS.valePackages].map(
            (path) => `StylesPath = ${relative(dirname(planned.targetPath), path)}`,
        ),
        MIN_ALERT_LINE,
        `SkippedScopes = ${VALE_SKIPPED_SCOPES}`,
        `Packages = ${VALE_PACKAGES.map((name) => VALE_PACKAGE_URLS[name]).join(', ')}`,
        VOCAB_LINE,
        '',
        '[formats]',
        ...formats.map(([extension, format]) => `${extension} = ${format}`),
        '',
        ALL_FILES_SECTION,
        `BasedOnStyles = ${['gspot', 'Vale', ...VALE_PACKAGES].join(', ')}`,
        `BlockIgnores = ${BLOCK_IGNORES.join(', ')}`,
        `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
        ...Object.entries(VALE_OFF_RULES).flatMap(([rule, reason]) => [`# ${reason}`, `${rule} = NO`]),
        MARKUP_RULES_COMMENT,
        ...VALE_MARKUP_RULES.map((rule) => `${rule} = NO`),
        '',
        `[*.{${formats.map(([extension]) => extension).join(',')}}]`,
        NO_STYLES_LINE,
        ...VALE_COMMENT_RULES.map((rule) => `${rule} = YES`),
        '',
        `[${VALE_MARKUP_FILES}]`,
        ...VALE_MARKUP_RULES.map((rule) => `${rule} = YES`),
    ];
    return lines.join('\n');
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
