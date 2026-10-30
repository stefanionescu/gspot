import type { Loader, DataStore } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { buildCheckIndex } from '#docs/reference/checks.ts';
import { buildCommandPage } from '#docs/reference/commands.ts';
import { buildSettingsPage } from '#docs/reference/settings.ts';
import { buildPluginPage } from '#docs/reference/eslint-plugin.ts';
import type { GuideSlug, ReferencePage } from '#docs/types/reference.ts';
import { buildConfigurationPages } from '#docs/reference/configurations.ts';

import {
    GUIDES,
    PAGES_FOLDER,
    REFERENCE_PATH,
    SECTION_HEADING,
    DOCS_SOURCE_NAME,
    REFERENCE_FOLDERS,
    REFERENCE_IDS_KEY,
} from '#docs/config/reference.ts';

function getGuideTitles(store: DataStore): Record<GuideSlug, string> {
    const titles = {} as Record<GuideSlug, string>;
    for (const slug of Object.values(GUIDES)) {
        const title = store.get(slug)?.data['title'];
        if (typeof title !== 'string') throw new TypeError(`The guide ${slug} has no loaded page title.`);
        titles[slug] = title;
    }
    return titles;
}

/**
Load the hand-written and generated pages into the Starlight content collection.
*/
export function buildDocsSource(): Loader {
    return {
        name: DOCS_SOURCE_NAME,
        async load(context) {
            const previous = JSON.parse(context.meta.get(REFERENCE_IDS_KEY) ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const ids: string[] = [];
            const pages = new Map<string, ReferencePage>([
                [`${REFERENCE_FOLDERS.commands}/index`, buildCommandPage()],
                ...buildConfigurationPages(getGuideTitles(context.store)),
                [`${REFERENCE_FOLDERS.settings}/index`, buildSettingsPage()],
                [`${REFERENCE_FOLDERS.eslintPlugin}/index`, buildPluginPage()],
                [`${REFERENCE_FOLDERS.checks}/index`, buildCheckIndex()],
            ]);
            for (const [path, page] of pages) {
                const id = `${REFERENCE_PATH.slice(1)}${path}`;
                const { body } = page;
                const metadata = await context.parseData({
                    id,
                    data: {
                        ...page.data,
                        tableOfContents: page.data.tableOfContents ?? (SECTION_HEADING.test(body) ? undefined : false),
                    },
                });
                const filePath = `${PAGES_FOLDER}/${id}.md`;
                context.store.set({
                    id,
                    filePath,
                    data: metadata,
                    body,
                    rendered: await context.renderMarkdown(body, { fileURL: new URL(filePath, context.config.root) }),
                    digest: context.generateDigest(JSON.stringify(page)),
                });
                ids.push(id);
            }
            context.meta.set(REFERENCE_IDS_KEY, JSON.stringify(ids));
        },
    };
}
