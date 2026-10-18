import { BASE_INSTALLED_FILES } from '#tests/data/test-setup.ts';

/** Markup with URLs that run code, at the column of each attribute, and scheme text in places that do not run it. */
export const URL_MARKUP_CASES = [
    { markup: '<a href="javascript:alert(1)">Link</a>', columns: [4] },
    { markup: '<a href="jav&#x61;script&colon;alert(1)">Link</a>', columns: [4] },
    { markup: '<a href="java&#9;script:alert(1)">Link</a>', columns: [4] },
    { markup: '<a href=" VbScRiPt:msgbox(1)">Link</a>', columns: [4] },
    { markup: '<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', columns: [4] },
    { markup: '<iframe src="data:text/html,example"></iframe>', columns: [9] },
    { markup: '<object data="data:image/svg+xml,example"></object>', columns: [9] },
    { markup: '<script src="data:text/javascript,alert(1)"></script>', columns: [9] },
    { markup: '<a href="/page">Link</a><script src="/app.js"></script>', columns: [] },
    { markup: '<a href="/page" title="javascript: is a scheme">Link</a>', columns: [] },
    { markup: '<img src="data:image/png;base64,aW1hZ2U=" alt="Image">', columns: [] },
    { markup: '<img src="data:image/svg+xml,example" alt="Image">', columns: [] },
    { markup: '<a href="data:text/plain,example" download>Download</a>', columns: [] },
    { markup: '<script type="application/ld+json">{"name":"example"}</script>', columns: [] },
] as const;

/** A page with two autoplay findings at the same places in source and built output. */
export const AUTOPLAY_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<audio src="sound.ogg" autoplay controls></audio>
<video src="movie.mp4" autoplay controls></video>
</main>
</body>
</html>
`;

/** The fix gives the visitor control of playback. */
export const CONTROLLED_PLAYBACK_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<audio src="sound.ogg" controls></audio>
<video src="movie.mp4" controls></video>
</main>
</body>
</html>
`;

/** The app scope builds its own page; the root scope still checks its source HTML. */
export const AUTOPLAY_SCOPE_SETTINGS = `[[scope]]\npath = "app"\nconfigurations = ["site"]\n[scope.site]\nbuild_command = ["node", "build.mjs"]\n`;

/** Each command runs one HTML Validate check and leaves the other source file unchanged. */
export const AUTOPLAY_CHECKS = [
    {
        check: 'html/html-validate',
        scope: '',
        arguments: ['check', 'index.html', '--json', '--only', 'html/html-validate'],
        source: 'index.html',
        preserved: 'app/page.html',
        configuration: '.gspot/config/html-validate-source.json',
        findings: [
            { file: 'index.html', line: 7, column: 24, rule: 'no-autoplay' },
            { file: 'index.html', line: 8, column: 24, rule: 'no-autoplay' },
        ],
    },
    {
        check: 'site/html-validate',
        scope: 'app',
        arguments: ['check', 'app', '--json', '--only', 'site/html-validate'],
        source: 'app/page.html',
        preserved: 'index.html',
        configuration: '.gspot/config/app/html-validate-built.json',
        findings: [
            { file: 'app/dist/index.html', line: 7, rule: 'no-autoplay' },
            { file: 'app/dist/index.html', line: 8, rule: 'no-autoplay' },
        ],
    },
] as const;

export const CHECKS_HTML_INSTALLED_SANDBOX = {
    configurations: ['html', 'site'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
