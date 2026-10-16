import type { Loader } from 'astro/loaders';
import { buildCommandPages } from './commands.ts';
import { referenceData } from '#cli/reference.ts';
import { buildSettingsPages } from './settings.ts';
import { buildPluginPages } from './eslint-plugin.ts';
import { docsLoader } from '@astrojs/starlight/loaders';
import type { ReferencePage } from '../types/reference.ts';
import { buildCheckPage, buildCheckIndex } from './checks.ts';
import { buildConfigurationPages } from './configurations.ts';

import {
    PAGES_FOLDER,
    SECTION_HEADING,
    REFERENCE_FOLDERS,
    REFERENCE_IDS_KEY,
    REFERENCE_COLLECTION_NAME,
} from '../config/reference.ts';

/**
 * Assemble generated pages from one read of the CLI reference data.
 * @returns pages keyed by their Markdown path
 */
function buildReferencePages(): Map<string, ReferencePage> {
    const data = referenceData();
    const pages = new Map([
        ...buildCommandPages(data.commands),
        ...buildConfigurationPages(data),
        ...buildSettingsPages(data),
        ...buildPluginPages(),
        [`${REFERENCE_FOLDERS.checks}/index.md`, buildCheckIndex(data.checks, data.groups)],
    ]);
    for (const { check, configuration } of data.checks)
        pages.set(`${REFERENCE_FOLDERS.checks}/${check.name}.md`, buildCheckPage(check, configuration));
    return pages;
}

/**
 * Load hand-written and generated pages into Starlight's content collection.
 * @returns the Astro loader
 */
export function buildReferenceCollection(): Loader {
    return {
        name: REFERENCE_COLLECTION_NAME,
        async load(context) {
            const previous = JSON.parse(context.meta.get(REFERENCE_IDS_KEY) ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const entries = [];
            for (const [path, page] of buildReferencePages()) {
                const id = `reference/${path.slice(0, -'.md'.length)}`;
                if (context.store.has(id)) throw new Error(`Duplicate reference identity: ${id}`);
                const { body } = page;
                const metadata = await context.parseData({
                    id,
                    data: { ...page.data, tableOfContents: SECTION_HEADING.test(body) ? undefined : false },
                });
                entries.push({
                    id,
                    filePath: `${PAGES_FOLDER}/${id}.md`,
                    data: metadata,
                    body,
                    rendered: await context.renderMarkdown(body),
                    digest: context.generateDigest(JSON.stringify(page)),
                });
            }
            for (const entry of entries) context.store.set(entry);
            context.meta.set(REFERENCE_IDS_KEY, JSON.stringify(entries.map((entry) => entry.id)));
        },
    };
}
