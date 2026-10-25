export const LINK_PAGE = `<!doctype html>
<html lang="en"><head><title>Setup</title></head><body><h1 id="setup">Setup</h1><p>Current setup.</p></body></html>
`;

export const LINK_SCOPE_TABLES = `[docs]
allowed_urls = { value = ["/root-only$"], reason = "The root guide describes an unavailable endpoint." }
[[scope]]
path = "app"
configurations = []
[scope.docs]
allowed_urls = { value = ["/child-only$"], reason = "The child guide describes an unavailable endpoint." }
`;

export const LINK_TEXT_CASES = [
    { text: 'absent', failures: [{ scope: '', file: 'root.md', rule: 'ERROR' }] },
    { text: 'Current%20setup', failures: [] },
] as const;

export const ROOT_LINK_FILES = {
    'root.md': '# Links\n\nRead [the setup guide](/guides/setup.md#setup).\n',
    'guides/setup.md': '# Setup\n',
    'guides/shop.mdx': '# Shop\n\n<a href={link}>Open the shop</a>\n',
    'web/index.md': '# Shop\n\nRead [the install page](/start/install/).\n',
} as const;
