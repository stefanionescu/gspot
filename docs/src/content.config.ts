import { defineCollection } from 'astro:content';
import { CLI_REFERENCE } from '#cli/reference.ts';
import { docsSchema } from '@astrojs/starlight/schema';
import { guideSchema } from '#docs/schemas/content.ts';
import { docsLoader } from '@astrojs/starlight/loaders';
import type { Loader, LoaderContext } from 'astro/loaders';
import { buildCommandPage } from '#docs/reference/commands.ts';
import { buildSettingsPage } from '#docs/reference/settings.ts';
import { buildPluginPages } from '#docs/reference/eslint-plugin.ts';
import { buildConfigurationPages } from '#docs/reference/configurations.ts';
import { buildCheckIndex, formatCheckTable } from '#docs/reference/checks.ts';
import type { ReferencePage, ConfigurationGuide } from '#docs/types/pages.ts';

import {
    PAGES_FOLDER,
    REFERENCE_PATH,
    DOCS_SOURCE_NAME,
    REFERENCE_FOLDERS,
    REFERENCE_IDS_KEY,
} from '#docs/config/reference.ts';

async function buildGuideIndex(context: LoaderContext): Promise<Map<string, ConfigurationGuide>> {
    const guides = new Map<string, ConfigurationGuide>();
    const stored = context.store.values();
    for (const guide of stored) {
        const { title, configurations } = guideSchema.parse(guide.data);
        if (configurations.length === 0) continue;
        for (const name of configurations) guides.set(name, { title, slug: guide.id });
        const checks = CLI_REFERENCE.checks.filter(({ configuration }) => configurations.includes(configuration.name));
        const table = await context.renderMarkdown(formatCheckTable(checks));
        const frontmatter = { ...guide.data, checksTable: table.html };
        context.store.set({ ...guide, data: frontmatter, digest: context.generateDigest(JSON.stringify(frontmatter)) });
    }
    return guides;
}

/**
Load the hand-written and generated pages into the Starlight content collection.
*/
function buildDocsSource(): Loader {
    return {
        name: DOCS_SOURCE_NAME,
        async load(context) {
            const previous = JSON.parse(context.meta.get(REFERENCE_IDS_KEY) ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const ids: string[] = [];
            const pages = new Map<string, ReferencePage>([
                [`${REFERENCE_FOLDERS.commands}/index`, buildCommandPage()],
                ...buildConfigurationPages(await buildGuideIndex(context)),
                [`${REFERENCE_FOLDERS.settings}/index`, buildSettingsPage()],
                ...buildPluginPages(),
                [`${REFERENCE_FOLDERS.checks}/index`, buildCheckIndex()],
            ]);
            for (const [path, page] of pages) {
                const id = `${REFERENCE_PATH.slice(1)}${path}`;
                const { body } = page;
                const metadata = await context.parseData({
                    id,
                    data: page.data,
                });
                const filePath = `${PAGES_FOLDER}/${id}.md`;
                const document = await context.renderMarkdown(body, {
                    fileURL: new URL(filePath, context.config.root),
                });
                if (page.headings !== undefined) document.metadata = { ...document.metadata, headings: page.headings };
                context.store.set({
                    id,
                    filePath,
                    data: metadata,
                    body,
                    rendered: document,
                    digest: context.generateDigest(JSON.stringify(page)),
                });
                ids.push(id);
            }
            context.meta.set(REFERENCE_IDS_KEY, JSON.stringify(ids));
        },
    };
}

export const collections = {
    docs: defineCollection({ loader: buildDocsSource(), schema: docsSchema({ extend: guideSchema }) }),
};
