import { stringify } from 'yaml';
import { dirname, relative } from 'node:path/posix';
import type { Session } from '#cli/types/session.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { VALE_STYLES_PATH, VALE_PACKAGES_PATH } from '#cli/config/gspot-paths.ts';

import {
    ACRONYMS,
    VALE_PACKAGES,
    PROSE_FORMATS,
    LENGTH_STYLES,
    BLOCK_IGNORES,
    TOKEN_IGNORES,
    VALE_OFF_RULES,
    ALT_TEXT_TOKENS,
    BANNED_HEADINGS,
    VALE_MARKUP_RULES,
    VALE_MARKUP_FILES,
    VALE_REGEX_SYMBOLS,
    VALE_SKIPPED_SCOPES,
    VALE_PACKAGE_RELEASES,
    VALE_PACKAGE_REPOSITORY,
} from '#cli/config/generation/settings/builders/vale.ts';

function escapeWord(word: string): string {
    return word.replaceAll(VALE_REGEX_SYMBOLS, String.raw`\$&`);
}

function listExceptions(words: string[]): string[] {
    return [...new Set([...words, ...ACRONYMS])].map((word) => escapeWord(word));
}

/**
 * Build the Vale sentence-case rule for headings below the title.
 *
 * @param planned the tool file to build.
 * @returns the heading capitalization rule.
 */
export function buildHeadingCaseStyle(planned: PlannedToolFile): string {
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
 * @param planned the tool file to build.
 * @returns the title capitalization rule.
 */
export function buildTitleCaseStyle(planned: PlannedToolFile): string {
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
 * Build the Vale acronyms style from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Vale acronym rule with the allowed acronyms.
 */
export function buildAcronymsStyle(planned: PlannedToolFile): string {
    const words = listAllowedWords(planned.session);

    return stringify({
        extends: 'conditional',
        message: "'%s' is used without being spelled out on first use.",
        level: 'error',
        ignorecase: false,
        first: String.raw`\b([A-Z]{3,6})\b`,
        second: String.raw`(?:\b[A-Za-z]+(?:-[A-Za-z]+)* ){2,5}\(([A-Z]{3,6})\)`,
        exceptions: listExceptions(words),
    });
}

/**
 * Name the release archive of one upstream style, so Vale installs that release and not the latest.
 *
 * @param name the style.
 * @returns the archive address.
 */
function buildPackageUrl(name: (typeof VALE_PACKAGES)[number]): string {
    const release = VALE_PACKAGE_RELEASES[name];
    return `${VALE_PACKAGE_REPOSITORY}${name}/releases/download/${release}/${name}.zip`;
}

/**
 * Build the Vale INI file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Vale style locations and rule levels for the prose checks.
 */
export function buildValeIniFile(planned: PlannedToolFile): string {
    const isAll = planned.level === 'all';
    const folders = isAll ? [VALE_STYLES_PATH, VALE_PACKAGES_PATH] : [VALE_STYLES_PATH];
    const styles = folders.map((path) => relative(dirname(planned.targetPath), path));
    // The gspot style holds only the files of this level, so no line turns a gspot rule off.
    const lines = [
        ...(isAll ? ['# Vale reads both StylesPath lines in order and installs packages in the last folder.'] : []),
        ...styles.map((path) => `StylesPath = ${path}`),
        'MinAlertLevel = suggestion',
        `SkippedScopes = ${VALE_SKIPPED_SCOPES}`,
        ...(isAll
            ? [`Packages = ${VALE_PACKAGES.map((name) => buildPackageUrl(name)).join(', ')}`, 'Vocab = words']
            : []),
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
 * Build the Vale alt text style from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Vale alternative-text rule.
 */
export function buildAltTextStyle(planned: PlannedToolFile): string {
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
 * Build the Vale banned headings style from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Vale rule for the banned headings.
 */
export function buildBannedHeadingsStyle(planned: PlannedToolFile): string {
    const headings = [...new Set([...BANNED_HEADINGS, ...getTable(planned.selection.view, 'docs').banned_headings])];
    return stringify({
        extends: 'existence',
        message: "Heading '%s' inventories the tree. Document behavior and ownership instead.",
        level: 'error',
        ignorecase: true,
        scope: 'heading',
        nonword: true,
        tokens: headings.map((heading) => String.raw`(?:\b|^)${escapeWord(heading)}(?:\b|$)`),
    });
}

/**
 * Build the Vale list item style from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Vale list-item punctuation rule.
 */
export function buildListItemStyle(planned: PlannedToolFile): string {
    const max = getTable(planned.selection.view, 'prose').max_list_item_words;
    return stringify({
        ...LENGTH_STYLES.item,
        message: `A list item longer than ${String(max)} words. Split it or make it a paragraph.`,
        level: 'error',
        max,
    });
}

/**
 * Build the Vale paragraph length style from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Vale paragraph length rule with the configured ceiling.
 */
export function buildParagraphLengthStyle(planned: PlannedToolFile): string {
    const max = getTable(planned.selection.view, 'prose').max_paragraph_sentences;
    return stringify({
        ...LENGTH_STYLES.paragraph,
        message: `A paragraph longer than ${String(max)} sentences. Split it.`,
        level: 'error',
        max,
    });
}

/**
 * Build the Vale sentence length style from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Vale sentence length rule with the configured ceiling.
 */
export function buildSentenceLengthStyle(planned: PlannedToolFile): string {
    const max = getTable(planned.selection.view, 'prose').max_sentence_words;
    return stringify({
        ...LENGTH_STYLES.sentence,
        message: `A sentence longer than ${String(max)} words. Split it.`,
        level: 'error',
        max,
    });
}

/**
 * Build the Vale possessives style from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Vale possessive-form rule.
 */
export function buildPossessivesStyle(planned: PlannedToolFile): string {
    const names = listProductNames(planned.session);

    return stringify({
        extends: 'existence',
        message: "Possessive on a product or code name: '%s'. Rephrase with 'of' or 'the'.",
        level: 'error',
        nonword: true,
        tokens: [String.raw`\b(?:${names.map((name) => escapeWord(name)).join('|')})'s\b`],
    });
}

/**
 * Build the Vale accepted words file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the accepted product names and your own allowed words, one per line.
 */
export function buildAcceptedWordsFile(planned: PlannedToolFile): string {
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
    const words = Object.keys(session.settingsFile.settings.allowed_words);
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
            session.scopes.flatMap(({ selected }) =>
                selected.flatMap((configuration) => [
                    ...configuration.tools.map((tool) => tool.name),
                    ...configuration.allowed_words,
                ]),
            ),
        ),
    ];
}
