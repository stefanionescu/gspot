import { test, expect } from 'bun:test';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { listPythonEnvironmentReads, listJavascriptEnvironmentReads } from '#cli/parsers/code/environment.ts';

test('JSX text is not an environment read and destructuring records the original property', () => {
    const reads = listJavascriptEnvironmentReads(
        'App.tsx',
        'const view = <p>process.env.FAKE</p>; const { API_KEY: key, [dynamic]: value, ...rest } = process.env;',
        [],
    );
    expect(reads.map(({ key }) => key)).toStrictEqual(['API_KEY']);
});

test('component JSX script blocks preserve their environment read locations', () => {
    const reads = listJavascriptEnvironmentReads(
        'App.vue',
        '<p>process.env.FAKE</p>\n<script lang="tsx">const x = <p>process.env.TEXT</p>;\nconst y = process.env.ACTUAL;\n</script>',
        [],
    );
    expect(reads.map(({ key, line }) => ({ key, line }))).toStrictEqual([{ key: 'ACTUAL', line: 3 }]);
});

test('Python reads use the preceding import binding and decode literal escapes', async () => {
    using tree = await parseSource(
        'python',
        'import os\nfirst = os.getenv("API\\x5fKEY")\nos = object()\nsecond = os.getenv("IGNORED")\n',
    );
    expect(listPythonEnvironmentReads(tree.rootNode, []).map(({ key }) => key)).toStrictEqual(['API_KEY']);
});
