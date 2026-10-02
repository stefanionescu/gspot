// Every guide the package ships reaches a repository: the base layers always, any other through a kit that names it.
import { test, expect } from 'bun:test';
import { listAssets } from '#cli/platform/assets.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { AGENT_LAYERS, RULES_PREFIX } from '#cli/config/rules.ts';

test('every shipped guide is installed by the base layers or named by a kit', () => {
    const guides = kitManifests()
        .values()
        .flatMap((manifest) => Object.values(manifest.guides).flat());
    const named = new Set(guides.map(({ path }) => path));
    const unreached = listAssets(RULES_PREFIX)
        .map((path) => path.slice(RULES_PREFIX.length))
        .filter((path) => path.endsWith('.md') && !named.has(path))
        .filter((path) => ![...AGENT_LAYERS].some((layer) => path.startsWith(`${layer}/`)));
    expect(unreached).toStrictEqual([]);
});
