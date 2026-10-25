import { CLI_REFERENCE } from './cli.ts';
import { buildCommandPage } from './commands.ts';
import { buildSettingsPage } from './settings.ts';
import { buildPluginPages } from './eslint-plugin.ts';
import type { Loader, DataStore } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { buildConfigurationPages } from './configurations.ts';
import type { GuideSlug, ReferencePage } from '../types/reference.ts';
import { buildCheckPage, buildCheckIndex, listSuppressions } from './checks.ts';

import {
    GUIDES,
    PAGES_FOLDER,
    REFERENCE_PATH,
    SECTION_HEADING,
    DOCS_SOURCE_NAME,
    REFERENCE_FOLDERS,
    REFERENCE_IDS_KEY,
} from '../config/reference.ts';

function getGuideTitles(store: DataStore): Record<GuideSlug, string> {
    const titles = {} as Record<GuideSlug, string>;
    for (const slug of Object.values(GUIDES)) {
        const title = store.get(slug)?.data['title'];
        if (typeof title !== 'string') throw new TypeError(`The guide ${slug} has no loaded page title.`);
        titles[slug] = title;
    }
    return titles;
}

function buildReferencePages(guideTitles: Record<GuideSlug, string>): Map<string, ReferencePage> {
    const pages = new Map([
        [`${REFERENCE_FOLDERS.commands}/index`, buildCommandPage()],
        ...buildConfigurationPages(guideTitles),
        [`${REFERENCE_FOLDERS.settings}/index`, buildSettingsPage()],
        ...buildPluginPages(),
        [`${REFERENCE_FOLDERS.checks}/index`, buildCheckIndex()],
    ]);
    const suppressions = listSuppressions(CLI_REFERENCE.configurations);
    for (const { check, configuration } of CLI_REFERENCE.checks)
        pages.set(`${REFERENCE_FOLDERS.checks}/${check.id}`, buildCheckPage(check, configuration, suppressions));
    return pages;
}

/**
Load the hand-written and generated pages into the Starlight content collection.

@returns the Astro loader
*/
export function createDocsSource(): Loader {
    return {
        name: DOCS_SOURCE_NAME,
        async load(context) {
            const previous = JSON.parse(context.meta.get(REFERENCE_IDS_KEY) ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const ids: string[] = [];
            for (const [path, page] of buildReferencePages(getGuideTitles(context.store))) {
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
