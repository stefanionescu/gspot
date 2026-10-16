import { test, expect } from 'bun:test';
import { readAsset } from '#cli/system/assets.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readPresets } from '#cli/generation/eslint/presets.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { RULE_NAME_FILES } from '#tests/config/configurations.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { ruleNamesFileSchema } from '#cli/generation/tool-files/stylelint.ts';

test('each lint-rule list names the pinned package version', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const pins = listToolProjectPins(manifests).npm;
    for (const path of RULE_NAME_FILES) {
        const names = ruleNamesFileSchema.parse(JSON.parse(readAsset(path)));
        expect(pins[names.package], path).toBe(names.version);
    }
    for (const manifest of manifests.filter((manifest) => Object.keys(manifest.eslint.presets).length > 0)) {
        const presets = readPresets(manifest);
        expect(Object.keys(presets), manifest.configuration.name).toStrictEqual(Object.keys(manifest.eslint.presets));
        for (const [name, declaration] of Object.entries(manifest.eslint.presets))
            expect(presets[name], `${manifest.configuration.name}/${name}`).toMatchObject({
                package: declaration.package,
                source: declaration.source,
                version: pins[declaration.package],
            });
    }
});
