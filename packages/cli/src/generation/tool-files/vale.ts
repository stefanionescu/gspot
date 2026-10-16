import { stringify } from 'yaml';
import type { Session } from '#cli/types/planning.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { dirname, basename, relative } from 'node:path/posix';
import { type ProseInputs, type ToolFileContext } from '#cli/types/generation/files.ts';
import { STYLES_DIRECTORY, VALE_PACKAGE_DIRECTORY } from '#cli/config/system/locations.ts';
import { VALE_PACKAGES, PROSE_FORMATS, VALE_RULE_EXTENSION } from '#cli/config/tools/vale.ts';

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
    RECOMMENDED_STYLES,
    VALE_SKIPPED_SCOPES,
} from '#cli/config/generation/prose.ts';

function escapeWord(word: string): string {
    return word.replaceAll(VALE_REGEX_SYMBOLS, String.raw`\$&`);
}

function listExceptions(prose: ProseInputs): string[] {
    return [...new Set([...prose.words, ...ACRONYMS])].map((element) => escapeWord(element));
}
/**
 * Build the heading or title capitalization style declared by this file.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Vale heading capitalization rule.
 */
function buildCapitalizationStyle(context: ToolFileContext): string {
    const prose = buildProseInputs(context.session, context.manifests);
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
 * Build acronyms style from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Vale acronym rule with the selected acronym allowance.
 */
function buildAcronymsStyle(context: ToolFileContext): string {
    const prose = buildProseInputs(context.session, context.manifests);

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
 * Build vale ini file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Vale style locations and rule levels for the selected prose checks.
 */
function buildValeIniFile(context: ToolFileContext): string {
    const isAll = context.level === 'all';
    const prose = buildProseInputs(context.session, context.manifests);
    const { targetPath } = context;

    const rules: Record<string, string> = isAll
        ? Object.fromEntries(Object.keys(VALE_OFF_RULES).map((rule) => [rule, 'NO']))
        : Object.fromEntries(
              prose.rules.filter((rule) => !RECOMMENDED_STYLES.has(rule)).map((rule) => [`gspot.${rule}`, 'NO']),
          );
    const folders = [STYLES_DIRECTORY];
    const basedOn = ['gspot'];
    const packages: string[] = [];
    const markupRules: string[] = [];
    if (isAll) {
        folders.push(VALE_PACKAGE_DIRECTORY);
        basedOn.push('Vale', ...VALE_PACKAGES);
        packages.push(`Packages = ${VALE_PACKAGES.join(', ')}`);
        markupRules.push('gspot.merge-conflict-markers = YES');
    }
    const styles = folders.map((path) => relative(dirname(targetPath), path));
    const lines = [
        '# Vale reads several StylesPath lines in order and installs packages in the last folder.',
        ...styles.map((path) => `StylesPath = ${path}`),
        'MinAlertLevel = suggestion',
        `SkippedScopes = ${VALE_SKIPPED_SCOPES}`,
        ...packages,
        'Vocab = words',
        '',
        '[formats]',
        ...PROSE_FORMATS.map(([extension, format]) => `${extension} = ${format}`),
        '',
        '[*]',
        `BasedOnStyles = ${basedOn.join(', ')}`,
        `BlockIgnores = ${BLOCK_IGNORES.join(', ')}`,
        `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
    ];
    for (const [rule, value] of Object.entries(rules)) {
        const reason = VALE_OFF_RULES[rule];
        if (reason !== undefined) lines.push(`# ${reason}`);
        lines.push(`${rule} = ${value}`);
    }
    lines.push(
        '# Markup checks read markup only.',
        'gspot.merge-conflict-markers = NO',
        '',
        `[${VALE_MARKUP_FILES}]`,
        'gspot.alt-text = YES',
        ...markupRules,
        '',
    );
    return `${lines.join('\n')}\n`;
}
/**
 * Build alt text style from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
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
 * Build banned headings style from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Vale rule for the configured prohibited headings.
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
 * Build list item style from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Vale list-item punctuation rule.
 */
function buildListItemStyle(context: ToolFileContext): string {
    const { limit } = context.selection.view;

    const max = limit('list_item_words');
    return stringify({
        ...LENGTH_STYLES.item,
        message: `A list item longer than ${String(max)} words. Split it or make it a paragraph.`,
        level: 'error',
        max,
    });
}
/**
 * Build paragraph length style from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Vale paragraph length rule with the configured ceiling.
 */
function buildParagraphLengthStyle(context: ToolFileContext): string {
    const { limit } = context.selection.view;

    const max = limit('paragraph_sentences');
    return stringify({
        ...LENGTH_STYLES.paragraph,
        message: `A paragraph longer than ${String(max)} sentences. Split it.`,
        level: 'error',
        max,
    });
}
/**
 * Build sentence length style from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Vale sentence length rule with the configured ceiling.
 */
function buildSentenceLengthStyle(context: ToolFileContext): string {
    const { limit } = context.selection.view;

    const max = limit('sentence_words');
    return stringify({
        ...LENGTH_STYLES.sentence,
        message: `A sentence longer than ${String(max)} words. Split it.`,
        level: 'error',
        max,
    });
}
/**
 * Build possessives style from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Vale possessive-form rule.
 */
function buildPossessivesStyle(context: ToolFileContext): string {
    const names = productNames(context.session);

    return stringify({
        extends: 'existence',
        message: "Possessive on a product or code name: '%s'. Rephrase with 'of' or 'the'.",
        level: 'error',
        nonword: true,
        tokens: [String.raw`\b(?:${names.map((name) => escapeWord(name)).join('|')})'s\b`],
    });
}
/**
 * Build accepted words file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the accepted product names and your own allowed words, one per line.
 */
function buildAcceptedWordsFile(context: ToolFileContext): string {
    const prose = buildProseInputs(context.session, context.manifests);

    return prose.words.toSorted((left, right) => left.localeCompare(right)).join('\n') + '\n';
}
/**
 * Compute the selected prose packages, vocabulary, and file formats.
 *
 * @param session the effective repository session.
 * @param manifests the selected manifests.
 *
 * @returns prose asset inputs.
 */
function buildProseInputs(session: Session, manifests: Manifest[]): ProseInputs {
    // The selected manifest list owns this prose entry for the run.
    const cached = session.reads.memo.get(manifests) as ProseInputs | undefined;
    if (cached !== undefined) return cached;
    const words = session.settingsFile.settings.allowed_words;
    const prose = {
        words: [...new Set([...productNames(session), ...words])],
        rules: manifests.flatMap((manifest) =>
            manifest.toolFiles
                .filter((file) => file.tool.includes('vale') && file.target.endsWith(VALE_RULE_EXTENSION))
                .map((file) => basename(file.target, VALE_RULE_EXTENSION)),
        ),
    };
    session.reads.memo.set(manifests, prose);
    return prose;
}

/**
 * List product names supplied by the selected tools and configurations.
 * @param session the repository inventory, selected configurations, and effective settings.
 * @returns the distinct tool names and allowed product words for the Vale vocabulary.
 */
function productNames(session: Session): string[] {
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
