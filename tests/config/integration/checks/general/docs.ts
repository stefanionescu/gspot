/** The same HTML page supports anchor and text-fragment checks locally and over HTTP. */

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const LINK_PAGE = `<!doctype html>
<html lang="en"><head><title>Setup</title></head><body><h1 id="setup">Setup</h1><p>Current setup.</p></body></html>
`;

/** Child URL exceptions add to the root list but do not cover root links. */
export const LINK_SCOPE_TABLES = `[docs]
allowed_urls = { value = ["/root-only$"], reason = "The root guide describes an unavailable endpoint." }
[[scope]]
path = "app"
configurations = []
[scope.docs]
allowed_urls = { value = ["/child-only$"], reason = "The child guide describes an unavailable endpoint." }
`;

/** A missing text fragment, and a fragment that matches the page. */
export const LINK_TEXT_CASES = [
    { text: 'absent', failures: [{ scope: '', file: 'root.md', rule: 'ERROR' }] },
    { text: 'Current%20setup', failures: [] },
] as const;

export const ROOT_LINK_FILES = {
    'gspot.toml': buildSandboxSettings([], {
        level: 'recommended',
        rules: true,
        scopes: [{ path: 'web', configurations: ['site'] }],
        tables: '[scope.site]\nbuild_command = ["node", "build.mjs"]\n',
    }),
    'root.md': '# Links\n\nRead [the setup guide](/guides/setup.md#setup).\n',
    'guides/setup.md': '# Setup\n',
    'guides/shop.mdx': '# Shop\n\n<a href={link}>Open the shop</a>\n',
    'web/index.md': '# Shop\n\nRead [the install page](/start/install/).\n',
} as const;
