import { REFERENCE_FOLDERS } from '../config/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
import type { StarlightUserConfig } from '@astrojs/starlight/types';

import {
    REFERENCE_END,
    SIDEBAR_GROUPS,
    REFERENCE_LISTS,
    REFERENCE_LABEL,
    REFERENCE_START,
} from '../config/navigation.ts';

type ReferenceData = ReturnType<typeof readReferenceData>;

/**
 * List the generated pages of one kind, as one collapsed group per area.
 * @param data everything the CLI exports for the reference
 * @param kind checks or configurations
 * @returns the area groups that have pages, in area order
 */
function listByArea(data: ReferenceData, kind: (typeof REFERENCE_LISTS)[number]['kind']) {
    const members =
        kind === 'checks'
            ? data.checks.map(({ check, configuration }) => ({
                  group: configuration.configuration.group,
                  name: check.name,
              }))
            : data.configurations.map(({ configuration }) => ({
                  group: configuration.group,
                  name: configuration.name,
              }));
    return Object.entries(data.groups)
        .map(([group, title]) => ({
            label: title,
            collapsed: true,
            items: members
                .filter((member) => member.group === group)
                .map(({ name }) => ({ slug: `reference/${REFERENCE_FOLDERS[kind]}/${name}` })),
        }))
        .filter(({ items }) => items.length > 0);
}

/**
 * Build the sidebar: the fixed groups, then Reference with every check and configuration listed by area.
 * @param data everything the CLI exports for the reference
 * @returns the Starlight sidebar
 */
export function buildSidebar(data: ReferenceData): NonNullable<StarlightUserConfig['sidebar']> {
    const lists = REFERENCE_LISTS.map(({ label, indexLabel, kind }) => ({
        label,
        collapsed: true,
        items: [{ label: indexLabel, slug: `reference/${REFERENCE_FOLDERS[kind]}/index` }, ...listByArea(data, kind)],
    }));
    return [
        ...SIDEBAR_GROUPS,
        { label: REFERENCE_LABEL, collapsed: false, items: [...REFERENCE_START, ...lists, ...REFERENCE_END] },
    ];
}
