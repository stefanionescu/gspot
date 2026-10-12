import { PurgeCSS } from 'purgecss';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename, relative } from 'node:path';
import { glob, rename, readFile, writeFile } from 'node:fs/promises';

import {
    STYLESHEETS,
    STYLE_TOKENS,
    STYLE_CONTENT,
    STYLE_FILE_HASH,
    STYLE_TOKEN_END,
    STYLE_HASH_LENGTH,
    STYLE_ASSET_FOLDER,
    STYLE_HASH_ENCODING,
    STYLE_TEXT_ENCODING,
    STYLE_FILE_REQUIRED,
    STYLESHEET_EXTENSION,
    STYLE_HASH_ALGORITHM,
    STYLE_PSEUDO_CLASSES,
} from './config/styles.ts';

// Include utility class separators, but discard a JavaScript property's trailing colon.
function styleTokens(content: string): string[] {
    return [...content.matchAll(STYLE_TOKENS)]
        .map(([token]) => {
            let end = token.length;
            while (end > 0 && token[end - 1] === STYLE_TOKEN_END) end--;
            return token.slice(0, end);
        })
        .filter((token) => token !== '');
}

/**
 * Remove unused built styles and refresh their content hashes after all pages and scripts exist.
 * @param dir the completed site directory.
 * @returns after writing the styles and their references.
 */
export async function purgeStyles(dir: URL): Promise<void> {
    const folder = fileURLToPath(dir);
    const documents: string[] = [];
    for await (const file of glob(STYLE_CONTENT, { cwd: folder })) documents.push(join(folder, file));
    const report = await new PurgeCSS().purge({
        content: documents,
        css: [join(folder, STYLESHEETS)],
        defaultExtractor: styleTokens,
        safelist: { standard: [STYLE_PSEUDO_CLASSES] },
    });
    const styles = report.map(({ file, css }) => {
        assert.ok(file !== undefined, STYLE_FILE_REQUIRED);
        return { file, css };
    });
    const replacements = new Map<string, string>();
    await Promise.all(styles.map(({ file, css }) => writeFile(file, css)));
    for (const { file, css } of styles.filter(({ file }) => dirname(relative(folder, file)) === STYLE_ASSET_FOLDER)) {
        const hash = createHash(STYLE_HASH_ALGORITHM)
            .update(css)
            .digest(STYLE_HASH_ENCODING)
            .slice(0, STYLE_HASH_LENGTH);
        const next = basename(file).replace(STYLE_FILE_HASH, `.${hash}${STYLESHEET_EXTENSION}`);
        await rename(file, join(dirname(file), next));
        replacements.set(basename(file), next);
    }
    for (const file of documents) {
        const content = await readFile(file, STYLE_TEXT_ENCODING);
        let next = content;
        for (const [before, after] of replacements) next = next.replaceAll(before, after);
        if (next !== content) await writeFile(file, next);
    }
}
