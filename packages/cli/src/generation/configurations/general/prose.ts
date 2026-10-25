import { stringify } from 'yaml';
import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { dirname, relative } from 'node:path/posix';
import type { Session } from '#cli/types/session.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    ACRONYMS,
    BLOCK_IGNORES,
    LENGTH_STYLES,
    PROSE_FORMATS,
    TOKEN_IGNORES,
    VALE_PACKAGES,
    VALE_OFF_RULES,
    ALT_TEXT_TOKENS,
    BANNED_HEADINGS,
    VALE_STYLES_PATH,
    VALE_MARKUP_FILES,
    VALE_MARKUP_RULES,
    VALE_COMMENT_RULES,
    VALE_REGEX_SYMBOLS,
    VALE_SKIPPED_SCOPES,
    CAPITALIZATION_STYLES,
    VALE_PACKAGE_RELEASES,
    VALE_PACKAGE_REPOSITORY,
} from '#cli/config/generation/configurations/general/prose.ts';

function listExceptions(words: string[]): string[] {
    return [...new Set([...words, ...ACRONYMS])].map((word) =>
        word.replaceAll(VALE_REGEX_SYMBOLS, (symbol) => '\\' + symbol),
    );
}

/**
Build the title or heading capitalization rule with the accepted vocabulary.

@param planned the generated config file and scope.
@param name whether to check heading or title case.
@returns the Vale capitalization rule.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function buildCapitalizationStyle(planned: PlannedConfigFile, name: keyof typeof CAPITALIZATION_STYLES): string {
    return stringify({
        ...CAPITALIZATION_STYLES[name],
        extends: 'capitalization',
        level: 'error',
        exceptions: listExceptions(listAllowedWords(planned.session)),
    });
}

/**
Build the `acronyms` style of Vale: the Vale acronym rule with the allowed acronyms.

@param planned the config file with its scope, level, and target path.
@returns the Vale acronym rule with the allowed acronyms.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The config-file builder calls it by its target path.
export function buildAcronymsStyle(planned: PlannedConfigFile): string {
    const words = listAllowedWords(planned.session);

    return stringify({
        extends: 'conditional',
        message: "Spell out '%s' on first use.",
        level: 'error',
        ignorecase: false,
        first: String.raw`\b([A-Z]{3,6})\b`,
        second: String.raw`(?:\b[A-Za-z]+(?:-[A-Za-z]+)* ){2,5}\(([A-Z]{3,6})\)`,
        exceptions: listExceptions(words),
    });
}

/**
Build vale.ini: the Vale style locations and rule levels for the prose checks.

@param planned the config file with its scope, level, and target path.
@returns the Vale style locations and rule levels for the prose checks.
*/
export function buildValeIniFile(planned: PlannedConfigFile): string {
    const isAll = planned.level === 'all';
    const folders = isAll ? [VALE_STYLES_PATH, GSPOT_PATHS.valePackages] : [VALE_STYLES_PATH];
    const styles = folders.map((path) => relative(dirname(planned.targetPath), path));
    const packages = VALE_PACKAGES.map(
        (name) =>
            `${VALE_PACKAGE_REPOSITORY}${name}/releases/download/${VALE_PACKAGE_RELEASES[name].version}/${name}.zip`,
    );
    const lines = [
        ...(isAll ? ['# Vale reads both StylesPath lines in order and installs packages in the last folder.'] : []),
        ...styles.map((path) => `StylesPath = ${path}`),
        'MinAlertLevel = suggestion',
        `SkippedScopes = ${VALE_SKIPPED_SCOPES}`,
        ...(isAll ? [`Packages = ${packages.join(', ')}`, 'Vocab = words'] : []),
        '',
        '[formats]',
        ...PROSE_FORMATS.map(([extension, format]) => `${extension} = ${format}`),
        '',
        '[*]',
        `BasedOnStyles = ${(isAll ? ['gspot', 'Vale', ...VALE_PACKAGES] : ['gspot']).join(', ')}`,
        `BlockIgnores = ${BLOCK_IGNORES.join(', ')}`,
        `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
        ...(isAll ? Object.entries(VALE_OFF_RULES).flatMap(([rule, reason]) => [`# ${reason}`, `${rule} = NO`]) : []),
        '# Markup checks read markup only.',
        'gspot.alt-text = NO',
        ...(isAll ? VALE_MARKUP_RULES.map((rule) => `${rule} = NO`) : []),
        '',
        `[*.{${PROSE_FORMATS.map(([extension]) => extension).join(',')}}]`,
        'BasedOnStyles =',
        ...VALE_COMMENT_RULES.map((rule) => `${rule} = YES`),
        '',
        `[${VALE_MARKUP_FILES}]`,
        'gspot.alt-text = YES',
        ...(isAll ? VALE_MARKUP_RULES.map((rule) => `${rule} = YES`) : []),
    ];
    return lines.join('\n');
}

/**
Build the `alt-text` style of Vale: the Vale alternative-text rule.

@param planned the config file with its scope, level, and target path.
@returns the Vale alternative-text rule.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The config-file builder calls it by its target path.
export function buildAltTextStyle(planned: PlannedConfigFile): string {
    const isAll = planned.level === 'all';

    return stringify({
        extends: 'existence',
        message: 'An image needs an alt attribute; decorative images can use an empty value.',
        level: 'error',
        scope: 'raw',
        nonword: true,
        tokens: [ALT_TEXT_TOKENS[0], ...(isAll ? [ALT_TEXT_TOKENS[1]] : [])],
    });
}

/**
Build the `banned-headings` style of Vale: the Vale rule for the banned headings.

@param planned the config file with its scope, level, and target path.
@returns the Vale rule for the banned headings.
*/
export function buildBannedHeadingsStyle(planned: PlannedConfigFile): string {
    const headings = [...new Set([...BANNED_HEADINGS, ...getTable(planned.scope.settings, 'docs').banned_headings])];
    return stringify({
        extends: 'existence',
        message: "Heading '%s' lists files and folders. Describe behavior and ownership instead.",
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
@returns the Vale occurrence rule.
*/
export function buildLengthStyle(planned: PlannedConfigFile, name: keyof typeof LENGTH_STYLES): string {
    const { setting, message, ...style } = LENGTH_STYLES[name];
    const max = getTable(planned.scope.settings, 'prose')[setting];
    return stringify({ ...style, message: message.replace('{{max}}', () => String(max)), level: 'error', max });
}

/**
Build the accepted words of Vale: the accepted product names and your own allowed words, one per line.

@param planned the config file with its scope, level, and target path.
@returns the accepted product names and your own allowed words, one per line.
*/
export function buildAcceptedWordsFile(planned: PlannedConfigFile): string {
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
