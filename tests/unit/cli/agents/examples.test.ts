import { parse } from 'smol-toml';
import { expect, test } from 'bun:test';
import { allRuleExamples, ruleExamples } from '#cli/agents/examples.ts';

test('every shipped Good fence has a native language owner or is explanatory text', () => {
    const examples = allRuleExamples();
    const languages = new Set(['python', 'bash', 'swift', 'ts', 'dockerfile', 'toml', 'text', 'diff']);
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.filter((example) => !languages.has(example.language))).toStrictEqual([]);
    for (const example of examples.filter((entry) => entry.language === 'toml'))
        expect(() => parse(example.body), `${example.file}:${String(example.line)}`).not.toThrow();
});

test('good examples retain nested labels, source positions, and enclosing level markers', () => {
    const text = [
        '# Guide',
        '',
        'Good:',
        '',
        '```python',
        'value = 1',
        '```',
        '',
        'Bad:',
        '',
        '```python',
        'value =',
        '```',
        '',
        '## Convention',
        '<!-- level: all -->',
        '',
        '### Detail',
        '',
        '**Good example:**',
        '',
        '```ts',
        'const value = 1;',
        '```',
        '',
        '## Safety',
        '',
        '> Good:',
        '>',
        '> ```bash',
        String.raw`> printf "%s\n" safe`,
        '> ```',
        '',
        '```markdown',
        'Good:',
        '```',
        '',
    ].join('\n');
    expect(ruleExamples({ path: 'language/EXAMPLE.md', text })).toStrictEqual([
        { file: 'language/EXAMPLE.md', line: 5, language: 'python', body: 'value = 1\n', level: 'recommended' },
        { file: 'language/EXAMPLE.md', line: 22, language: 'ts', body: 'const value = 1;\n', level: 'all' },
        {
            file: 'language/EXAMPLE.md',
            line: 30,
            language: 'bash',
            body: 'printf "%s\\n" safe\n',
            level: 'recommended',
        },
    ]);
});
