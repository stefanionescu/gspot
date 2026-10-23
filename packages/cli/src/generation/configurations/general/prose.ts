import { stringify } from 'yaml';
import { getTable } from '#cli/settings/scopes.ts';
import { dirname, relative } from 'node:path/posix';
import type { Session } from '#cli/types/session.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
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
    VALE_REGEX_SYMBOLS,
    VALE_SKIPPED_SCOPES,
    VALE_PACKAGE_RELEASES,
    VALE_PACKAGE_REPOSITORY,
} from '#cli/config/generation/configurations/general/prose.ts';

function listExceptions(words: string[]): string[] {
    return [...new Set([...words, ...ACRONYMS])].map((word) =>
        word.replaceAll(VALE_REGEX_SYMBOLS, BACKSLASH_BEFORE_MATCH),
    );
}

/**
 * Build the Vale sentence-case rule for headings below the title.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the heading capitalization rule.
 */
export function buildHeadingCaseStyle(planned: PlannedConfigFile): string {
    return stringify({
        extends: 'capitalization',
        message: "Headings below the title use sentence case: '%s'.",
        level: 'error',
        scope: 'heading.h2',
        match: '$sentence',
        exceptions: listExceptions(listAllowedWords(planned.session)),
    });
}

/**
 * Build the Vale title-case rule for the document title.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the title capitalization rule.
 */
export function buildTitleCaseStyle(planned: PlannedConfigFile): string {
    return stringify({
        extends: 'capitalization',
        message: "The document title uses title case: '%s'.",
        level: 'error',
        scope: 'heading.h1',
        match: '$title',
        exceptions: listExceptions(listAllowedWords(planned.session)),
    });
}

/**
 * Build the `acronyms` style of Vale: the Vale acronym rule with the allowed acronyms.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Vale acronym rule with the allowed acronyms.
 */
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
 * Build vale.ini: the Vale style locations and rule levels for the prose checks.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Vale style locations and rule levels for the prose checks.
 */
export function buildValeIniFile(planned: PlannedConfigFile): string {
    const isAll = planned.level === 'all';
    const folders = isAll ? [VALE_STYLES_PATH, GSPOT_PATHS.valePackages] : [VALE_STYLES_PATH];
    const styles = folders.map((path) => relative(dirname(planned.targetPath), path));
    const packages = VALE_PACKAGES.map(
        (name) => `${VALE_PACKAGE_REPOSITORY}${name}/releases/download/${VALE_PACKAGE_RELEASES[name]}/${name}.zip`,
    );
    // The gspot style holds only the files of this level, so no line turns a gspot rule off.
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
        `[${VALE_MARKUP_FILES}]`,
        'gspot.alt-text = YES',
        ...(isAll ? VALE_MARKUP_RULES.map((rule) => `${rule} = YES`) : []),
    ];
    return lines.join('\n');
}

/**
 * Build the `alt-text` style of Vale: the Vale alternative-text rule.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Vale alternative-text rule.
 */
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
 * Build the `banned-headings` style of Vale: the Vale rule for the banned headings.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Vale rule for the banned headings.
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
            (heading) => String.raw`(?:\b|^)${heading.replaceAll(VALE_REGEX_SYMBOLS, BACKSLASH_BEFORE_MATCH)}(?:\b|$)`,
        ),
    });
}

/**
 * Build the `item-length` style of Vale: the Vale rule for the longest list item, in words.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Vale list-item length rule.
 */
export function buildBulletLengthStyle(planned: PlannedConfigFile): string {
    const max = getTable(planned.scope.settings, 'prose').max_list_item_words;
    return stringify({
        ...LENGTH_STYLES.item,
        message: `A list item longer than ${String(max)} words. Split it or make it a paragraph.`,
        level: 'error',
        max,
    });
}

/**
 * Build the `paragraph-length` style of Vale: the Vale paragraph length rule with the configured ceiling.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Vale paragraph length rule with the configured ceiling.
 */
export function buildParagraphLengthStyle(planned: PlannedConfigFile): string {
    const max = getTable(planned.scope.settings, 'prose').max_paragraph_sentences;
    return stringify({
        ...LENGTH_STYLES.paragraph,
        message: `A paragraph longer than ${String(max)} sentences. Split it.`,
        level: 'error',
        max,
    });
}

/**
 * Build the `sentence-length` style of Vale: the Vale sentence length rule with the configured ceiling.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Vale sentence length rule with the configured ceiling.
 */
export function buildSentenceLengthStyle(planned: PlannedConfigFile): string {
    const max = getTable(planned.scope.settings, 'prose').max_sentence_words;
    return stringify({
        ...LENGTH_STYLES.sentence,
        message: `A sentence longer than ${String(max)} words. Split it.`,
        level: 'error',
        max,
    });
}

/**
 * Build the `possessives` style of Vale: the Vale possessive-form rule.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Vale possessive-form rule.
 */
export function buildPossessivesStyle(planned: PlannedConfigFile): string {
    const names = listProductNames(planned.session);

    return stringify({
        extends: 'existence',
        message: "Possessive on a product or code name: '%s'. Rephrase with 'of' or 'the'.",
        level: 'error',
        nonword: true,
        tokens: [
            String.raw`\b(?:${names.map((name) => name.replaceAll(VALE_REGEX_SYMBOLS, BACKSLASH_BEFORE_MATCH)).join('|')})'s\b`,
        ],
    });
}

/**
 * Build the accepted words of Vale: the accepted product names and your own allowed words, one per line.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the accepted product names and your own allowed words, one per line.
 */
export function buildAcceptedWordsFile(planned: PlannedConfigFile): string {
    const words = listAllowedWords(planned.session);

    return words.toSorted((left, right) => left.localeCompare(right)).join('\n');
}

/**
 * List the shared Vale vocabulary.
 *
 * @param session the repository and its selected scopes.
 * @returns each allowed product name or word once.
 */
function listAllowedWords(session: Session): string[] {
    const words = session.scopes.flatMap((scope) => Object.keys(getTable(scope.settings, 'spelling').allowed_words));
    return [...new Set([...listProductNames(session), ...words])];
}

/**
 * List the product names of the tools and configurations.
 *
 * @param session the repository and its tools.
 * @returns each tool name and allowed product word once, for the Vale vocabulary.
 */
function listProductNames(session: Session): string[] {
    return [
        ...new Set(
            session.scopes.flatMap(({ configurations }) =>
                configurations.flatMap((configuration) => [
                    ...configuration.tools.map((tool) => tool.name),
                    ...configuration.allowed_words,
                ]),
            ),
        ),
    ];
}
