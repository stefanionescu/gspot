import type { Loader } from 'astro/loaders';
import { commandPages } from './commands.ts';
import { section, referencePage } from './page.ts';
import { allChecks } from 'gspot/src/kits/listing.ts';
import { docsLoader } from '@astrojs/starlight/loaders';
import { kitReference, settingsPage } from './policy.ts';
import { kitManifests } from 'gspot/src/kits/manifests.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { kitPage, rulePage, enginesPage, pluginReferencePages } from './definitions.ts';

/**
 * Every generated reference page, keyed by its Markdown path: commands, configurations, rules, settings, and engines.
 * @returns the pages by identity
 */
export function referencePages(): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>();
    const add = (path: string, content: ReferencePage): void => {
        if (pages.has(path)) throw new Error(`Duplicate reference identity: ${path}`);
        pages.set(path, content);
    };
    for (const [path, page] of commandPages()) add(path, page);
    const manifests = kitManifests()
        .values()
        .toArray()
        .toSorted((a, b) => a.kit.name.localeCompare(b.kit.name));
    const kinds: [string, string][] = [
        ['language', 'Languages'],
        ['framework', 'Frameworks'],
        ['tool', 'Tools'],
        ['library', 'Libraries'],
        ['platform', 'Platforms'],
        ['database', 'Databases'],
        ['general', 'Repository checks'],
    ];
    add(
        'kits/index.md',
        referencePage(
            'Kit reference',
            'Choose kits by the files and tools they govern.',
            kinds
                .map(([kind, title]) =>
                    section(
                        title,
                        manifests
                            .filter((manifest) => manifest.kit.kind === kind)
                            .map(
                                (manifest) =>
                                    `[${manifest.kit.title}](/reference/kits/${manifest.kit.name}/): ${manifest.kit.description}`,
                            )
                            .map((item) => `- ${item}`)
                            .join('\n'),
                    ),
                )
                .join(''),
            'architecture/04-kits.md',
        ),
    );
    for (const manifest of manifests) add(`kits/${manifest.kit.name}.md`, kitPage(manifest));
    const checks = allChecks();
    for (const { check, kit: configuration } of checks.values())
        add(`rules/${check.name}.md`, rulePage(check, configuration));
    add('settings.md', settingsPage(manifests));
    add(
        'configuration.md',
        referencePage('Configuration file', 'All policy fields from the validated schema.', kitReference()),
    );
    add('engines.md', enginesPage(checks));
    for (const [path, page] of pluginReferencePages()) add(path, page);
    return pages;
}

/**
 * Load authored documentation and definition-owned references into one Astro collection.
 * @returns the Astro loader
 */
export function referenceCollection(): Loader {
    return {
        name: 'gspot-reference',
        async load(context) {
            const previous = JSON.parse(context.meta.get('reference-ids') ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const entries = [];
            for (const [path, page] of referencePages()) {
                const id = path === 'engines.md' ? 'development/engines' : `reference/${path.slice(0, -'.md'.length)}`;
                if (context.store.has(id)) throw new Error(`Duplicate reference identity: ${id}`);
                const { body } = page;
                const metadata = await context.parseData({ id, data: page.data });
                entries.push({
                    id,
                    filePath: `src/content/docs/${id}.md`,
                    data: metadata,
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
