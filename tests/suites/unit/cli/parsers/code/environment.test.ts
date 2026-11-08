import { expect, test } from 'bun:test';

import { listJavascriptEnvironmentReads, listPythonEnvironmentReads } from '#cli/parsers/code/environment.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';

test('JSX text is not an environment read and destructuring records the original property', async () => {
    const reads = await listJavascriptEnvironmentReads(
        'App.tsx',
        'const view = <p>process.env.FAKE</p>; const { API_KEY: key, [dynamic]: value, ...rest } = process.env;',
        [],
    );
    expect(reads.map(({ key }) => key)).toStrictEqual(['API_KEY']);
});

test('component JSX script blocks preserve their environment read locations', async () => {
    const reads = await listJavascriptEnvironmentReads(
        'App.vue',
        '<p>process.env.FAKE</p>\n<script lang="tsx">const x = <p>process.env.TEXT</p>;\nconst y = process.env.ACTUAL;\n</script>',
        [],
    );
    expect(reads.map(({ key, line }) => ({ key, line }))).toStrictEqual([{ key: 'ACTUAL', line: 3 }]);
});

test.each([
    ['process.env.ALPHA', 'ALPHA'],
    ["process.env['BRAVO']", 'BRAVO'],
    ['process.env[`CHARLIE`]', 'CHARLIE'],
    ['Bun.env.DELTA', 'DELTA'],
    ['import.meta.env.ECHO', 'ECHO'],
    ["Deno.env.get('FOXTROT')", 'FOXTROT'],
    ["selectSettingToEdit('GOLF')", 'GOLF'],
    ['const { HOTEL = 1 } = process.env', 'HOTEL'],
    ["const { 'INDIA': india } = process.env", 'INDIA'],
])('%s reads %s', async (source, key) => {
    const reads = await listJavascriptEnvironmentReads('app.ts', source, ['selectSettingToEdit']);
    expect(reads.map((read) => read.key)).toStrictEqual([key]);
});

test.each(['process.env[name]', 'process.env[`KEY_${suffix}`]'])('%s names no variable', async (source) => {
    expect(await listJavascriptEnvironmentReads('app.ts', source, [])).toStrictEqual([]);
});

test('Python reads use the preceding import binding and decode literal escapes', async () => {
    using tree = await parseSource(
        'python',
        'import os\nfirst = os.getenv("API\\x5fKEY")\nos = object()\nsecond = os.getenv("IGNORED")\n',
    );
    expect(listPythonEnvironmentReads(tree.rootNode, []).map(({ key }) => key)).toStrictEqual(['API_KEY']);
});
