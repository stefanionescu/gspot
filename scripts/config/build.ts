export const CLI_ENTRY_POINTS = [
    'src/main.ts',
    'src/checks/framework/site/linkinator-program.ts',
    'src/checks/framework/site/purgecss-program.ts',
] as const;
export const CLI_BANNER = '#!/usr/bin/env node';
export const CLI_EXECUTABLE = 'gspot.js';
export const DIST_FOLDER = 'dist';
export const LICENSE_FILE = 'LICENSE.md';
export const EXECUTABLE_FILE = 0o755;
export const ESLINT_PLUGIN_ENTRY = 'src/plugin.ts';
export const ESLINT_PLUGIN_EXECUTABLE = 'plugin.js';
export const THIRD_PARTY_NOTICE = `# Third-party notices

## @bacons/xcode 1.0.0-alpha.33

Copyright Evan Bacon

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
