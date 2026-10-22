/** A page with two autoplay findings at the same places in source and built output. */

import { BASE_INSTALLED_FILES } from '#tests/config/setup/sandboxes.ts';

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
export const AUTOPLAY_SCOPE_TABLES = `[[scope]]\npath = "app"\nconfigurations = ["site"]\n[scope.site]\nbuild_command = ["node", "build.mjs"]\n`;

/** Each command runs one HTML Validate check and leaves the other source file unchanged. */
export const AUTOPLAY_CHECKS = [
    {
        check: 'html/html-validate',
        scope: '',
        arguments: ['check', 'index.html', '--json', '--only', 'html/html-validate'],
        source: 'index.html',
        preserved: 'app/page.html',
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
        findings: [
            { file: 'app/dist/index.html', line: 7, rule: 'no-autoplay' },
            { file: 'app/dist/index.html', line: 8, rule: 'no-autoplay' },
        ],
    },
] as const;

export const HTML_SANDBOX = {
    configurations: ['html', 'site'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
