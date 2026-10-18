import { stringify } from 'yaml';
import { dirname, relative } from 'node:path/posix';
import type { Session } from '#cli/types/planning.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { VALE_PACKAGES, PROSE_FORMATS } from '#cli/config/tools/vale.ts';
import { VALE_STYLES_PATH, VALE_PACKAGES_PATH } from '#cli/config/system/locations.ts';
import { type ProseInputs, type ToolFileContext } from '#cli/types/generation/files.ts';

import {
    ACRONYMS,
    LENGTH_STYLES,
    BLOCK_IGNORES,
    TOKEN_IGNORES,
    VALE_OFF_RULES,
    ALT_TEXT_TOKENS,
    BANNED_HEADINGS,
    VALE_MARKUP_FILES,
    VALE_REGEX_SYMBOLS,
    VALE_SKIPPED_SCOPES,
} from '#cli/config/generation/vale.ts';

function escapeWord(word: string): string {
    return word.replaceAll(VALE_REGEX_SYMBOLS, String.raw`\$&`);
}

function listExceptions(prose: ProseInputs): string[] {
    return [...new Set([...prose.words, ...ACRONYMS])].map((element) => escapeWord(element));
}
/**
 * Build the heading or title capitalization style declared by this file.
 * @param context the tool file to build.
 * @returns the Vale heading capitalization rule.
 */
function buildCapitalizationStyle(context: ToolFileContext): string {
    const prose = buildProseInputs(context.session, context.session.neededToolManifests);
    const isTitle = context.toolFile.target.endsWith('/title-case.yml');
    return stringify({
        extends: 'capitalization',
        message: isTitle
            ? "The document title uses title case: '%s'."
            : "Headings below the title use sentence case: '%s'.",
        level: 'error',
        scope: isTitle ? 'heading.h1' : 'heading.h2',
        match: isTitle ? '$title' : '$sentence',
        exceptions: listExceptions(prose),
    });
}

/**
 * Build the Vale acronyms style from the settings.
 * @param context the tool file to build.
 * @returns the Vale acronym rule with the allowed acronyms.
 */
function buildAcronymsStyle(context: ToolFileContext): string {
    const prose = buildProseInputs(context.session, context.session.neededToolManifests);

    return stringify({
        extends: 'conditional',
        message: "'%s' is used without being spelled out on first use.",
        level: 'error',
        ignorecase: false,
        first: String.raw`\b([A-Z]{3,6})\b`,
        second: String.raw`(?:\b[A-Za-z]+(?:-[A-Za-z]+)* ){2,5}\(([A-Z]{3,6})\)`,
        exceptions: listExceptions(prose),
    });
}
/**
 * Build the Vale INI file from the settings.
 * @param context the tool file to build.
 * @returns the Vale style locations and rule levels for the prose checks.
 */
function buildValeIniFile(context: ToolFileContext): string {
    const isAll = context.level === 'all';
    const folders = isAll ? [VALE_STYLES_PATH, VALE_PACKAGES_PATH] : [VALE_STYLES_PATH];
    const styles = folders.map((path) => relative(dirname(context.targetPath), path));
    // The gspot style holds only the files of this level, so no line turns a gspot rule off.
    const lines = [
        ...(isAll ? ['# Vale reads both StylesPath lines in order and installs packages in the last folder.'] : []),
        ...styles.map((path) => `StylesPath = ${path}`),
        'MinAlertLevel = suggestion',
        `SkippedScopes = ${VALE_SKIPPED_SCOPES}`,
        ...(isAll ? [`Packages = ${VALE_PACKAGES.join(', ')}`, 'Vocab = words'] : []),
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
        ...(isAll ? ['gspot.merge-conflict-markers = NO'] : []),
        '',
        `[${VALE_MARKUP_FILES}]`,
        'gspot.alt-text = YES',
        ...(isAll ? ['gspot.merge-conflict-markers = YES'] : []),
        '',
    ];
    return `${lines.join('\n')}\n`;
}
/**
 * Build the Vale alt text style from the settings.
 * @param context the tool file to build.
 * @returns the Vale alternative-text rule.
 */
function buildAltTextStyle(context: ToolFileContext): string {
    const isAll = context.level === 'all';

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
 * @param context the tool file to build.
 * @returns the Vale rule for the banned headings.
 */
function buildBannedHeadingsStyle(context: ToolFileContext): string {
    const { settings } = context.selection.view;

    const headings = [...new Set([...BANNED_HEADINGS, ...(settings['docs.banned_headings'] as string[])])];
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
 * @param context the tool file to build.
 * @returns the Vale list-item punctuation rule.
 */
function buildListItemStyle(context: ToolFileContext): string {
    const max = context.selection.view.options('prose').max_list_item_words;
    return stringify({
        ...LENGTH_STYLES.item,
        message: `A list item longer than ${String(max)} words. Split it or make it a paragraph.`,
        level: 'error',
        max,
    });
}
/**
 * Build the Vale paragraph length style from the settings.
 * @param context the tool file to build.
 * @returns the Vale paragraph length rule with the configured ceiling.
 */
function buildParagraphLengthStyle(context: ToolFileContext): string {
    const max = context.selection.view.options('prose').max_paragraph_sentences;
    return stringify({
        ...LENGTH_STYLES.paragraph,
        message: `A paragraph longer than ${String(max)} sentences. Split it.`,
        level: 'error',
        max,
    });
}
/**
 * Build the Vale sentence length style from the settings.
 * @param context the tool file to build.
 * @returns the Vale sentence length rule with the configured ceiling.
 */
function buildSentenceLengthStyle(context: ToolFileContext): string {
    const max = context.selection.view.options('prose').max_sentence_words;
    return stringify({
        ...LENGTH_STYLES.sentence,
        message: `A sentence longer than ${String(max)} words. Split it.`,
        level: 'error',
        max,
    });
}
/**
 * Build the Vale possessives style from the settings.
 * @param context the tool file to build.
 * @returns the Vale possessive-form rule.
 */
function buildPossessivesStyle(context: ToolFileContext): string {
    const names = listProductNames(context.session);

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
 * @param context the tool file to build.
 * @returns the accepted product names and your own allowed words, one per line.
 */
function buildAcceptedWordsFile(context: ToolFileContext): string {
    const prose = buildProseInputs(context.session, context.session.neededToolManifests);

    return prose.words.toSorted((left, right) => left.localeCompare(right)).join('\n') + '\n';
}
/**
 * Compute the prose packages, vocabulary, and file formats.
 *
 * @param session the repository to check.
 * @param manifests the configurations in use.
 *
 * @returns the inputs of the prose files.
 */
function buildProseInputs(session: Session, manifests: Manifest[]): ProseInputs {
    // The manifest list keys this cached value for the run.
    const cached = session.reads.memo.get(manifests) as ProseInputs | undefined;
    if (cached !== undefined) return cached;
    const words = session.settingsFile.settings.allowed_words;
    const prose = { words: [...new Set([...listProductNames(session), ...words])] };
    session.reads.memo.set(manifests, prose);
    return prose;
}

/**
 * List the product names of the tools and configurations.
 * @param session the repository and its tools.
 * @returns each tool name and allowed product word once, for the Vale vocabulary.
 */
function listProductNames(session: Session): string[] {
    return [
        ...new Set(
            session.scopes.flatMap(({ selected }) =>
                selected.flatMap((manifest) => [...manifest.tools.map((tool) => tool.name), ...manifest.allowed_words]),
            ),
        ),
    ];
}

export {
    buildValeIniFile,
    buildAltTextStyle,
    buildAcronymsStyle,
    buildListItemStyle,
    buildPossessivesStyle,
    buildAcceptedWordsFile,
    buildCapitalizationStyle,
    buildBannedHeadingsStyle,
    buildSentenceLengthStyle,
    buildParagraphLengthStyle,
};
