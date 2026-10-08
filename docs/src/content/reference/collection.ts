import { checkPage } from './checks.ts';
import type { Loader } from 'astro/loaders';
import { commandPages } from './commands.ts';
import { pluginReferencePages } from './plugin.ts';
import { configurationPage } from './configurations.ts';
import { docsLoader } from '@astrojs/starlight/loaders';
import { settingsPage, policyReference } from './policy.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { cell, table, section, referencePage } from './page.ts';
import { CONFIGURATION_GROUPS } from '../../config/reference.ts';
import type { Manifest } from '@gspothq/cli/src/types/configurations.ts';
import { allChecks } from '@gspothq/cli/src/configurations/contracts.ts';
import { configurationManifests } from '@gspothq/cli/src/configurations/public.ts';

function configurationSections(manifests: Manifest[]): string {
    const sections: string[] = [];
    for (const [kind, title] of CONFIGURATION_GROUPS) {
        const entries = manifests
            .filter((manifest) => manifest.configuration.kind === kind)
            .map(
                ({ configuration }) =>
                    `- [${configuration.title}](/reference/configurations/${configuration.name}/): ${configuration.description}`,
            );
        sections.push(section(title, entries.join('\n')));
    }
    return sections.join('');
}

/**
 * Every generated reference page, keyed by its Markdown path: commands, configurations, checks, plugin rules, settings, and the policy file.
 * @returns the pages by identity
 */
export async function referencePages(): Promise<Map<string, ReferencePage>> {
    const pages = new Map<string, ReferencePage>();
    const add = (path: string, content: ReferencePage): void => {
        if (pages.has(path)) throw new Error(`Duplicate reference identity: ${path}`);
        pages.set(path, content);
    };
    for (const [path, page] of await commandPages()) add(path, page);
    const manifests = configurationManifests()
        .values()
        .toArray()
        .toSorted((a, b) => a.configuration.name.localeCompare(b.configuration.name));
    add(
        'configurations/index.md',
        referencePage(
            'Configuration reference',
            'Choose configurations by the files and tools they check.',
            configurationSections(manifests),
            'docs/src/content/reference/collection.ts',
        ),
    );
    for (const manifest of manifests)
        add(`configurations/${manifest.configuration.name}.md`, configurationPage(manifest, manifests));
    const checks = allChecks(configurationManifests().values());
    const checkRows = [...checks.values()]
        .toSorted((a, b) => a.check.name.localeCompare(b.check.name))
        .map(({ check, configuration }) => [
            `[\`${check.name}\`](/reference/checks/${check.name}/)`,
            `[${configuration.configuration.name}](/reference/configurations/${configuration.configuration.name}/)`,
            check.stage,
            check.level,
            check.tool ?? check.command?.[0] ?? 'gspot',
            cell(check.summary),
        ]);
    const index = table(['ID', 'Configuration', 'Stage', 'Level', 'Tool', 'Summary'], checkRows);
    add(
        'checks/index.md',
        referencePage(
            'Checks',
            `${String(checks.size)} checks declared by built-in configurations.`,
            index,
            'docs/src/content/reference/collection.ts',
        ),
    );

    for (const { check, configuration } of checks.values())
        add(`checks/${check.name}.md`, checkPage(check, configuration));
    add('settings.md', settingsPage(manifests));
    add(
        'gspot-toml.md',
        referencePage(
            'gspot.toml schema',
            'Policy tables, examples, and accepted fields.',
            policyReference(),
            'docs/src/content/reference/policy.ts',
        ),
    );
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
            for (const [path, page] of await referencePages()) {
                const id = `reference/${path.slice(0, -'.md'.length)}`;
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
