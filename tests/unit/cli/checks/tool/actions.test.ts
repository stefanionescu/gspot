// The workflow text actionlint reads: each self-repository marker of a reference becomes a local path at the same
// offsets, and everything else stays as written.
import { test, expect } from 'bun:test';
import { actionlintSource } from '#cli/checks/tool/actions.ts';

const PATH = '.github/workflows/called.yml';

test.each([
    [`$/${PATH}`, `./${PATH}`],
    [`"$/${PATH}"`, `"./${PATH}"`],
    [`'$/${PATH}'`, `'./${PATH}'`],
    [String.raw`"\x24/` + `${PATH}"`, String.raw`"\x2e/` + `${PATH}"`],
    ['"$/' + `${PATH}"`, '"./' + `${PATH}"`],
    [String.raw`"\U00000024/` + `${PATH}"`, String.raw`"\U0000002e/` + `${PATH}"`],
    [`|-\n          $/${PATH}`, `|-\n          ./${PATH}`],
    [`>-\n          $/${PATH}`, `>-\n          ./${PATH}`],
    [`|- # $comment\n          $/${PATH}`, `|- # $comment\n          ./${PATH}`],
    ['$/.github/workflows/$called.yml', './.github/workflows/$called.yml'],
    ['actions/checkout@v4', 'actions/checkout@v4'],
])('the reference %s reaches actionlint as %s', (reference, expected) => {
    const before = `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${reference}\n`;
    const prepared = actionlintSource(before);
    expect(prepared).toBe(`on: workflow_dispatch\njobs:\n  caller:\n    uses: ${expected}\n`);
    expect(prepared).toHaveLength(before.length);
});

test('an alias resolves to the anchored reference, which changes where it is written', () => {
    const workflow = `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/${PATH}\njobs:\n  caller:\n    uses: *workflow\n`;
    expect(actionlintSource(workflow)).toBe(workflow.replace(`$/${PATH}`, `./${PATH}`));
});

test('text that is not a YAML mapping stays as written', () => {
    expect(actionlintSource('uses: [$/unclosed\n')).toBe('uses: [$/unclosed\n');
});
