/** The same HTML target supports anchor and text-fragment checks locally and over HTTP. */
export const LINK_PAGE =
    '<!doctype html>\n<html lang="en"><head><title>Setup</title></head><body><h1 id="setup">Setup</h1><p>Current setup.</p></body></html>\n';

/** Child URL exceptions extend root policy without exempting root links. */
export const LINK_SCOPE_TABLES =
    '[agent_rules]\nenabled = false\n[tools.lychee]\nexclude_urls = [{ patterns = ["/root-only$"], reason = "The root guide describes an unavailable endpoint." }]\n[[scope]]\npath = "app"\nconfigurations = []\n[scope.tools.lychee]\nexclude_urls = [{ patterns = ["/child-only$"], reason = "The child guide describes an unavailable endpoint." }]\n';

/** Text-fragment failures and their independently valid correction. */
export const LINK_TEXT_CASES = [
    { fragment: 'absent', failures: [{ scope: '', file: 'root.md', rule: 'ERROR' }] },
    { fragment: 'Current%20setup', failures: [] },
];
