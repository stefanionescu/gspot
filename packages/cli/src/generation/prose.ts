import { stringify } from 'yaml';
import type { Session } from '#cli/types/planning.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { dirname, basename, relative } from 'node:path/posix';
import type { ScopeView } from '#cli/types/settings/values.ts';
import type { ProseInputs, ValeIniInputs } from '#cli/types/generation/files.ts';
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

function escapedWord(word: string): string {
    return word.replaceAll(VALE_REGEX_SYMBOLS, String.raw`\$&`);
}

function exceptions(prose: ProseInputs): string[] {
    return [...new Set([...prose.words, ...ACRONYMS])].map((element) => escapedWord(element));
}

/**
 * Write the shared vocabulary as sentence-case heading exceptions.
 *
 * @param root0 the values for this generated file.
 * @param root0.prose the vocabulary and prose rule inputs.
 *
 * @returns the Vale style text.
 */
export function headingCaseStyle({ prose }: { prose: ProseInputs }): string {
    return stringify({
        extends: 'capitalization',
        message: "Headings below the title use sentence case: '%s'.",
        level: 'error',
        scope: 'heading.h2',
        match: '$sentence',
        exceptions: exceptions(prose),
    });
}

/**
 * Write the shared vocabulary as title-case exceptions.
 *
 * @param root0 the values for this generated file.
 * @param root0.prose the vocabulary and prose rule inputs.
 *
 * @returns the Vale style text.
 */
export function titleCaseStyle({ prose }: { prose: ProseInputs }): string {
    return stringify({
        extends: 'capitalization',
        message: "The document title uses title case: '%s'.",
        level: 'error',
        scope: 'heading.h1',
        match: '$title',
        exceptions: exceptions(prose),
    });
}

/**
 * Write the shared vocabulary as first-use acronym exceptions.
 *
 * @param root0 the values for this generated file.
 * @param root0.prose the vocabulary and prose rule inputs.
 *
 * @returns the Vale style text.
 */
export function acronymsStyle({ prose }: { prose: ProseInputs }): string {
    return stringify({
        extends: 'conditional',
        message: "'%s' is used without being spelled out on first use.",
        level: 'error',
        ignorecase: false,
        first: String.raw`\b([A-Z]{3,6})\b`,
        second: String.raw`(?:\b[A-Za-z]+(?:-[A-Za-z]+)* ){2,5}\(([A-Z]{3,6})\)`,
        exceptions: exceptions(prose),
    });
}

/**
 * Build the repository's single Vale configuration.
 *
 * @param root0 the values for this generated file.
 * @param root0.targetPath the generated destination path.
 * @param root0.isAll whether the all level applies.
 * @param root0.prose the vocabulary and prose rule inputs.
 *
 * @returns the generated configuration text.
 */
export function valeIniToolFile({ targetPath = '.gspot/config/vale.ini', isAll, prose }: ValeIniInputs): string {
    const rules: Record<string, string> = isAll
        ? Object.fromEntries(Object.keys(VALE_OFF_RULES).map((rule) => [rule, 'NO']))
        : Object.fromEntries(
              prose.rules
                  .filter((rule) => !new Set<string>(RECOMMENDED_STYLES).has(rule))
                  .map((rule) => [`gspot.${rule}`, 'NO']),
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
        const reason = Object.entries(VALE_OFF_RULES).find(([name]) => name === rule)?.[1];
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
 * Write required alternative text checks for the selected level.
 *
 * @param root0 the values for this generated file.
 * @param root0.isAll whether the all level applies.
 *
 * @returns the Vale style text.
 */
export function altTextStyle({ isAll }: { isAll: boolean }): string {
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
 * Write your own and shipped banned heading patterns.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 *
 * @returns the Vale style text.
 */
export function bannedHeadingsStyle({ settings }: Pick<ScopeView, 'settings'>): string {
    const headings = [...new Set([...BANNED_HEADINGS, ...(settings['docs.banned_headings'] as string[])])];
    return stringify({
        extends: 'existence',
        message: "Heading '%s' inventories the tree. Document behavior and ownership instead.",
        level: 'error',
        ignorecase: true,
        scope: 'heading',
        nonword: true,
        tokens: headings.map((heading) => String.raw`(?:\b|^)${escapedWord(heading)}(?:\b|$)`),
    });
}

/**
 * Write the list item word limit.
 *
 * @param root0 the values for this generated file.
 * @param root0.limit the configured numeric limit reader.
 *
 * @returns the Vale style text.
 */
export function itemLengthStyle({ limit }: Pick<ScopeView, 'limit'>): string {
    const max = limit('list_item_words');
    return stringify({
        ...LENGTH_STYLES.item,
        message: `A list item longer than ${String(max)} words. Split it or make it a paragraph.`,
        level: 'error',
        max,
    });
}

/**
 * Write the paragraph sentence limit.
 *
 * @param root0 the values for this generated file.
 * @param root0.limit the configured numeric limit reader.
 *
 * @returns the Vale style text.
 */
export function paragraphLengthStyle({ limit }: Pick<ScopeView, 'limit'>): string {
    const max = limit('paragraph_sentences');
    return stringify({
        ...LENGTH_STYLES.paragraph,
        message: `A paragraph longer than ${String(max)} sentences. Split it.`,
        level: 'error',
        max,
    });
}

/**
 * Write the sentence word limit.
 *
 * @param root0 the values for this generated file.
 * @param root0.limit the configured numeric limit reader.
 *
 * @returns the Vale style text.
 */
export function sentenceLengthStyle({ limit }: Pick<ScopeView, 'limit'>): string {
    const max = limit('sentence_words');
    return stringify({
        ...LENGTH_STYLES.sentence,
        message: `A sentence longer than ${String(max)} words. Split it.`,
        level: 'error',
        max,
    });
}

/**
 * Write product-name possessive patterns using plain regular-expression escapes.
 *
 * @param root0 the values for this generated file.
 * @param root0.names the companion tool names.
 *
 * @returns the Vale style text.
 */
export function possessivesStyle({ names }: { names: string[] }): string {
    return stringify({
        extends: 'existence',
        message: "Possessive on a product or code name: '%s'. Rephrase with 'of' or 'the'.",
        level: 'error',
        nonword: true,
        tokens: [String.raw`\b(?:${names.map((name) => escapedWord(name)).join('|')})'s\b`],
    });
}

/**
 * Write a sorted, unique accepted vocabulary without template indentation.
 *
 * @param root0 the values for this generated file.
 * @param root0.prose the vocabulary and prose rule inputs.
 *
 * @returns the sorted accepted vocabulary.
 */
export function acceptedWordsToolFile({ prose }: { prose: ProseInputs }): string {
    return [...new Set(prose.words)].toSorted((left, right) => left.localeCompare(right)).join('\n') + '\n';
}
/**
 * Compute the selected prose packages, vocabulary, and file formats.
 *
 * @param session the effective repository session.
 * @param manifests the selected manifests.
 *
 * @returns prose asset inputs.
 */
export function proseInputs(session: Session, manifests: Manifest[]): ProseInputs {
    const words = session.settingsFile.settings.allowed_words;
    return {
        words: [
            ...new Set([
                ...session.scopes.flatMap(({ selected }) =>
                    selected.flatMap((manifest) => [
                        ...manifest.tools.map((tool) => tool.name),
                        ...manifest.allowed_words,
                    ]),
                ),
                ...words,
            ]),
        ],
        rules: manifests.flatMap((manifest) =>
            manifest.toolFiles
                .filter((file) => file.tool.includes('vale') && file.target.endsWith(VALE_RULE_EXTENSION))
                .map((file) => basename(file.target, VALE_RULE_EXTENSION)),
        ),
    };
}
