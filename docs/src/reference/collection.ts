import type { Loader } from 'astro/loaders';
import { commandPages } from './commands.ts';
import { gspotTomlPage } from './gspot-toml.ts';
import { checkPage, toolLabel } from './checks.ts';
import { configurationPage } from './configurations.ts';
import { docsLoader } from '@astrojs/starlight/loaders';
import { pluginReferencePages } from './eslint-plugin.ts';
import type { ReferencePage } from '../types/reference.ts';
import { GROUP_LABELS } from '#cli/config/configurations.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { cell, table, section, referencePage } from './markdown.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';
import { PAGES_FOLDER, REFERENCE_FOLDERS, REFERENCE_IDS_KEY, REFERENCE_COLLECTION_NAME } from '../config/reference.ts';

function configurationSections(manifests: Manifest[]): string {
    const sections: string[] = [];
    for (const [group, title] of Object.entries(GROUP_LABELS)) {
        const entries = manifests
            .filter((manifest) => manifest.configuration.group === group)
            .map(
                ({ configuration }) =>
                    `- [${configuration.title}](/reference/${REFERENCE_FOLDERS.configurations}/${configuration.name}/): ${configuration.description}`,
            );
        sections.push(section(title, entries.join('\n')));
    }
    return sections.join('');
}

/**
 * Every generated reference page, keyed by its Markdown path: commands, configurations, checks, plugin rules, settings, and gspot.toml.
 * @returns the pages by identity
 */
function referencePages(): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>();
    for (const [path, page] of commandPages()) pages.set(path, page);
    const manifests = readManifests(createReadCache(process.cwd()))
        .values()
        .toArray()
        .toSorted((a, b) => a.configuration.name.localeCompare(b.configuration.name));
    pages.set(
        `${REFERENCE_FOLDERS.configurations}/index.md`,
        referencePage(
            'Configuration reference',
            'Choose configurations by the files and tools they check.',
            configurationSections(manifests),
        ),
    );
    for (const manifest of manifests)
        pages.set(
            `${REFERENCE_FOLDERS.configurations}/${manifest.configuration.name}.md`,
            configurationPage(manifest, manifests),
        );
    const checks = listChecksById(readManifests(createReadCache(process.cwd())).values());
    const checkRows = [...checks.values()]
        .toSorted((a, b) => a.check.name.localeCompare(b.check.name))
        .map(({ check, configuration }) => [
            `[\`${check.name}\`](/reference/${REFERENCE_FOLDERS.checks}/${check.name}/)`,
            `[${configuration.configuration.name}](/reference/${REFERENCE_FOLDERS.configurations}/${configuration.configuration.name}/)`,
            check.stage,
            check.level,
            toolLabel(check),
            cell(check.summary),
        ]);
    const index = table(['ID', 'Configuration', 'Stage', 'Level', 'Tool', 'Summary'], checkRows);
    pages.set(
        `${REFERENCE_FOLDERS.checks}/index.md`,
        referencePage('Checks', `${String(checks.size)} checks declared by built-in configurations.`, index),
    );

    for (const { check, configuration } of checks.values())
        pages.set(`${REFERENCE_FOLDERS.checks}/${check.name}.md`, checkPage(check, configuration));

    pages.set('gspot-toml.md', gspotTomlPage(manifests));
    for (const [path, page] of pluginReferencePages()) pages.set(path, page);
    return pages;
}

/**
 * Load documentation and generated references into one Astro collection.
 * @returns the Astro loader
 */
export function referenceCollection(): Loader {
    return {
        name: REFERENCE_COLLECTION_NAME,
        async load(context) {
            const previous = JSON.parse(context.meta.get(REFERENCE_IDS_KEY) ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const entries = [];
            for (const [path, page] of referencePages()) {
                const id = `reference/${path.slice(0, -'.md'.length)}`;
                if (context.store.has(id)) throw new Error(`Duplicate reference identity: ${id}`);
                const { body } = page;
                const metadata = await context.parseData({ id, data: page.data });
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
