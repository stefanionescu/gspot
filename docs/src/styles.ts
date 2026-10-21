import { PurgeCSS } from 'purgecss';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DIGEST_ALGORITHM } from '#cli/config/text.ts';
import { join, dirname, basename, relative } from 'node:path';
import { glob, rename, readFile, writeFile } from 'node:fs/promises';

import {
    PURGECSS_EXTRACTOR,
    PURGECSS_TOKEN_END,
    PURGECSS_PSEUDO_CLASS_PATTERN,
} from '#cli/config/generation/settings/builders/purgecss.ts';
import {
    STYLESHEETS,
    STYLE_CONTENT,
    STYLE_FILE_HASH,
    STYLE_HASH_LENGTH,
    STYLE_ASSET_FOLDER,
    STYLE_FILE_REQUIRED,
} from './config/styles.ts';

// Keep utility class separators, but drop the trailing colon of a JavaScript property.
function extractStyleTokens(content: string): string[] {
    return [...content.matchAll(PURGECSS_EXTRACTOR)]
        .map(([token]) => {
            let end = token.length;
            while (end > 0 && token[end - 1] === PURGECSS_TOKEN_END) end--;
            return token.slice(0, end);
        })
        .filter((token) => token !== '');
}

/**
 * Remove unused built styles and update their content hashes. Run it after the build writes every page and script.
 *
 * @param siteFolder the built site
 * @returns a promise that resolves once the styles and their references hold the new hashes
 */
export async function pruneUnusedStyles(siteFolder: URL): Promise<void> {
    const folder = fileURLToPath(siteFolder);
    const documents: string[] = [];
    for await (const file of glob(STYLE_CONTENT, { cwd: folder })) documents.push(join(folder, file));
    const report = await new PurgeCSS().purge({
        content: documents,
        css: [join(folder, STYLESHEETS)],
        defaultExtractor: extractStyleTokens,
        safelist: { standard: [PURGECSS_PSEUDO_CLASS_PATTERN] },
    });
    const styles = report.map(({ file, css }) => {
        assert.ok(file !== undefined, STYLE_FILE_REQUIRED);
        return { file, css };
    });
    const replacements = new Map<string, string>();
    await Promise.all(styles.map(({ file, css }) => writeFile(file, css)));
    for (const { file, css } of styles.filter(({ file }) => dirname(relative(folder, file)) === STYLE_ASSET_FOLDER)) {
        const hash = createHash(DIGEST_ALGORITHM).update(css).digest('hex').slice(0, STYLE_HASH_LENGTH);
        const next = basename(file).replace(STYLE_FILE_HASH, `.${hash}.css`);
        await rename(file, join(dirname(file), next));
        replacements.set(basename(file), next);
    }
    for (const file of documents) {
        const content = await readFile(file, 'utf8');
        let next = content;
        for (const [before, after] of replacements) next = next.replaceAll(before, after);
        if (next !== content) await writeFile(file, next);
    }
}
