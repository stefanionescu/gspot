import { CLI_REFERENCE } from './cli.ts';
import { buildCommandPage } from './commands.ts';
import { buildSettingsPage } from './settings.ts';
import { buildPluginPages } from './eslint-plugin.ts';
import type { Loader, DataStore } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import type { ReferencePage } from '../types/reference.ts';
import { buildConfigurationPages } from './configurations.ts';
import { GROUP_LABELS } from '#cli/config/configurations/names.ts';
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

// Read authored frontmatter only after the content loader has populated its store.
function readGuideTitles(store: DataStore): Map<string, string> {
    const titles = new Map<string, string>();
    for (const slug of Object.values(GUIDES)) {
        const title = store.get(slug)?.data['title'];
        if (typeof title !== 'string') throw new Error(`The guide ${slug} has no loaded page title.`);
        titles.set(slug, title);
    }
    return titles;
}

/**
 * Assemble generated pages from one read of the CLI reference facts.
 *
 * @param guideTitles the authored guide titles keyed by slug.
 *
 * @returns pages keyed by their Markdown path
 */
function buildReferencePages(guideTitles: Map<string, string>): Map<string, ReferencePage> {
    const facts = CLI_REFERENCE;
    const pages = new Map([
        [`${REFERENCE_FOLDERS.commands}/index.md`, buildCommandPage(facts)],
        ...buildConfigurationPages(facts, guideTitles),
        [`${REFERENCE_FOLDERS.settings}/index.md`, buildSettingsPage(facts)],
        ...buildPluginPages(),
        [`${REFERENCE_FOLDERS.checks}/index.md`, buildCheckIndex(facts.checks, GROUP_LABELS)],
    ]);
    const suppressions = listSuppressions(facts.configurations);
    for (const { check, configuration } of facts.checks)
        pages.set(`${REFERENCE_FOLDERS.checks}/${check.id}.md`, buildCheckPage(check, configuration, suppressions));
    return pages;
}

/**
 * Load the hand-written and generated pages into the Starlight content collection.
 *
 * @returns the Astro loader
 */
export function createDocsSource(): Loader {
    return {
        name: DOCS_SOURCE_NAME,
        async load(context) {
            const previous = JSON.parse(context.meta.get(REFERENCE_IDS_KEY) ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const guideTitles = readGuideTitles(context.store);
            const pages = [];
            for (const [path, page] of buildReferencePages(guideTitles)) {
                const id = `${REFERENCE_PATH.slice(1)}${path.slice(0, -'.md'.length)}`;
                if (context.store.has(id)) throw new Error(`Two docs pages have the ID ${id}.`);
                const { body } = page;
                const metadata = await context.parseData({
                    id,
                    data: {
                        ...page.data,
                        tableOfContents: page.data.tableOfContents ?? (SECTION_HEADING.test(body) ? undefined : false),
                    },
                });
                const filePath = `${PAGES_FOLDER}/${id}.md`;
                pages.push({
                    id,
                    filePath,
                    data: metadata,
                    body,
                    // Starlight adds heading links only to Markdown with a path inside the docs collection.
                    rendered: await context.renderMarkdown(body, { fileURL: new URL(filePath, context.config.root) }),
                    digest: context.generateDigest(JSON.stringify(page)),
                });
            }
            for (const referencePage of pages) context.store.set(referencePage);
            context.meta.set(REFERENCE_IDS_KEY, JSON.stringify(pages.map((referencePage) => referencePage.id)));
        },
    };
}
