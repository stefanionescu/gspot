// The README, the quickstart, and the homepage show the one recorded example. Each page holds its files and output.
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import example from '#docs/src/components/home/example.json';

const root = new URL('../../../', import.meta.url);
const readme = readFileSync(new URL('README.md', root), 'utf8');
const quickstart = readFileSync(new URL('docs/src/content/docs/guides/quick-start.md', root), 'utf8');
// The quickstart indents its code blocks under numbered steps.
const unindented = quickstart.replaceAll(/^ {4}/gmu, '');

test('the quickstart holds every file, command, and recorded output of the example', () => {
    for (const file of [...example.project, ...example.agent.files, ...example.fix.files])
        expect(unindented).toContain(file.content.trimEnd());
    for (const command of Object.values(example.commands)) expect(unindented).toContain(command);
    expect(unindented).toContain(example.rejected.trimEnd());
    expect(unindented).toContain(example.passed);
});

test('the README shows the agent file, the recorded rejection, the fix, and the passing commit', () => {
    const [agentFile] = example.agent.files;
    expect(readme).toContain(agentFile!.content.trimEnd());
    expect(readme).toContain(example.rejected.trimEnd());
    expect(readme).toContain(example.fix.files[0]!.content.trimEnd());
    expect(readme).toContain(example.passed);
    expect(readme).toContain(example.commands.install);
});
