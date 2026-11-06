import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';
import type { Loader, LoaderContext } from 'astro/loaders';
import { z } from 'astro/zod';

import { CLI_REFERENCE } from '#cli/reference.ts';
import {
    CHANGELOG_PATH,
    DOCS_SOURCE_NAME,
    PAGES_FOLDER,
    REFERENCE_FOLDERS,
    REFERENCE_IDS_KEY,
    REFERENCE_PATH,
} from '#docs/config/reference.ts';
import { buildChangelogPage } from '#docs/reference/changelog.ts';
import { buildCheckIndex, formatCheckTable } from '#docs/reference/checks.ts';
import { buildCommandPage } from '#docs/reference/commands.ts';
import { buildConfigurationPages } from '#docs/reference/configurations.ts';
import { buildPluginPages } from '#docs/reference/eslint-plugin.ts';
import { buildSettingsPage } from '#docs/reference/settings.ts';
import type { ConfigurationGuide, ReferencePage } from '#docs/types/pages.ts';

const configurationNameSchema = z.enum(CLI_REFERENCE.configurations.map(({ name }) => name));

const guideSchema = z.object({
    title: z.string(),
    configurations: z.array(configurationNameSchema).default([]),
    checksTable: z.string().optional(),
});

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
                [CHANGELOG_PATH, buildChangelogPage()],
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
