import { test, expect } from 'bun:test';
import { hasIniSection } from '#cli/parsers/ini.ts';

test('an INI file has a section, or a subsection of it, only under an exact heading', () => {
    const selected =
        '[tool] # selected\r\nkey = value\r\n[other] trailing text\r\n[]\r\n[tool:child]; nested\r\nvalue = 2\r';
    expect(hasIniSection(`[unrelated]\r\nvalue = 1\r\n${selected}\n[toolbox]\nvalue = 3\n`, 'tool')).toBe(true);
    expect(hasIniSection('[toolbox]\nvalue = 3\n', 'tool')).toBe(false);
    expect(hasIniSection('[tool\nvalue = 3\n', 'tool')).toBe(false);
});
