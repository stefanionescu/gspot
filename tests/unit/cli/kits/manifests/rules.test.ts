// Every rule a kit installs only on a condition is a file of that kit's rules folder.
import { test, expect } from 'bun:test';
import { kitFiles } from '#cli/rules/assemble.ts';
import { kitManifests } from '#cli/kits/manifests.ts';

test('every conditional rule of a kit names a file in its rules folder', () => {
    for (const manifest of kitManifests().values()) expect(() => kitFiles(manifest), manifest.kit.name).not.toThrow();
});
