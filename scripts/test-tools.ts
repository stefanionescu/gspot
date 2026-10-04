// Write test-tool pins that the base generated mise configuration does not pin.
import { stringify } from 'smol-toml';
import { misePins } from '#cli/tools/mise.ts';
import { collectPins } from '#cli/tools/pins.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseMiseToolKeys } from '#cli/parsers/mise.ts';
import { MISE_MIN_VERSION } from '#cli/config/tools/mise.ts';
import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { TEST_TOOLS, TEST_TOOLS_PATH, PYTHON_TEST_TOOLS, TEST_TOOLS_HEADER } from '#automation/config/test-tools.ts';

const manifests = [...configurationManifests().values()];
const managed = parseMiseToolKeys(readFileSync(MISE_CONFIG_PATH, 'utf8'));
const tools: Record<string, unknown> = structuredClone(TEST_TOOLS);
for (const pin of misePins(manifests))
    tools[pin.name] = { version: pin.version, ...(pin.os === undefined ? {} : { os: pin.os }), ...pin.options };
for (const tool of collectPins(manifests)) {
    if (!PYTHON_TEST_TOOLS.includes(tool.name)) continue;
    const pin = tool.installers['pypi'];
    if (pin?.version === undefined) throw new Error(`The ${tool.name} test tool requires a pinned Python release.`);
    tools[`pipx:${pin.name}`] = { version: pin.version, depends: ['uv'] };
}
const remainingTools = Object.fromEntries(Object.entries(tools).filter(([name]) => !managed.has(name)));
writeFileSync(TEST_TOOLS_PATH, TEST_TOOLS_HEADER + stringify({ min_version: MISE_MIN_VERSION, tools: remainingTools }));
console.error('Wrote %s', TEST_TOOLS_PATH);
