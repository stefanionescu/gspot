// Write the mise pins of every kit tool from the manifests, so the test harness has one pin owner.
import { writeFileSync } from 'node:fs';
import { testToolsText } from '#cli/generation/tools/mise.ts';

const TEST_TOOLS_PATH = '.mise/conf.d/test-tools.toml';

writeFileSync(TEST_TOOLS_PATH, testToolsText());
console.log(`wrote ${TEST_TOOLS_PATH}`);
