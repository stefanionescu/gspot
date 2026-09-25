import { docsLoader } from '@astrojs/starlight/loaders';
import { allChecks } from '@gspot/cli/src/configurations/listing.ts';
import { configurationManifests } from '@gspot/cli/src/configurations/manifests.ts';
import type { Loader } from 'astro/loaders';
import { commandPages } from './commands';
import { configurationPage, enginesPage, pluginReferencePages, rulePage } from './definitions';
import type { ReferencePage } from './page';
import { bullets, referencePage, section } from './page';
import { configurationReference, settingsPage } from './policy';

export function referencePages(): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>();
    const add = (path: string, content: ReferencePage): void => {
        if (pages.has(path)) throw new Error(`Duplicate reference identity: ${path}`);
        pages.set(path, content);
    };
    for (const [path, page] of commandPages()) add(path, page);
    const manifests = configurationManifests()
        .values()
        .toArray()
        .toSorted((a, b) => a.configuration.name.localeCompare(b.configuration.name));
    const kinds = [
        ['language', 'Languages'],
        ['framework', 'Frameworks'],
        ['tool', 'Tools'],
        ['library', 'Libraries'],
        ['platform', 'Platforms'],
        ['database', 'Databases'],
        ['policy', 'Repository checks'],
    ];
    add(
        'configurations/index.md',
        referencePage(
            'Configuration reference',
            'Choose configurations by the files and tools they govern.',
            kinds
                .map(([kind, title]) =>
                    section(
                        title!,
                        bullets(
                            manifests
                                .filter((manifest) => manifest.configuration.kind === kind)
                                .map(
                                    (manifest) =>
                                        `[${manifest.configuration.title}](/reference/configurations/${manifest.configuration.name}/): ${manifest.configuration.description}`,
                                ),
                        ),
                    ),
                )
                .join(''),
            'architecture/04-configurations.md',
        ),
    );
    for (const manifest of manifests)
        add(`configurations/${manifest.configuration.name}.md`, configurationPage(manifest));
    const checks = allChecks();
    for (const { check, configuration } of checks.values())
        add(`rules/${check.name}.md`, rulePage(check, configuration));
    add('settings.md', settingsPage(manifests));
    add(
        'configuration.md',
        referencePage('Configuration file', 'All policy fields from the validated schema.', configurationReference()),
    );
    add('engines.md', enginesPage(checks));
    for (const [path, page] of pluginReferencePages()) add(path, page);
    return pages;
}

/** Load authored documentation and definition-owned references into one Astro collection. */
export function referenceLoader(): Loader {
    return {
        name: 'gspot-reference',
        async load(context) {
            const previous = JSON.parse(context.meta.get('reference-ids') ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const entries = [];
            for (const [path, page] of referencePages()) {
                const id = path === 'engines.md' ? 'development/engines' : `reference/${path.slice(0, -3)}`;
                if (context.store.has(id)) throw new Error(`Duplicate reference identity: ${id}`);
                const { body } = page;
                const data = await context.parseData({ id, data: page.data });
                entries.push({
                    id,
                    filePath: `src/content/docs/${id}.md`,
                    data,
                    body,
                    rendered: await context.renderMarkdown(body),
                    digest: context.generateDigest(JSON.stringify(page)),
                });
            }
            for (const entry of entries) context.store.set(entry);
            context.meta.set('reference-ids', JSON.stringify(entries.map((entry) => entry.id)));
        },
    };
}
