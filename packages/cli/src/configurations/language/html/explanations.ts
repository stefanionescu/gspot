import { HTML_RULES } from '#cli/config/configurations/language.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

export const HTML_EXPLANATIONS = {
    [HTML_RULES.inlineScript]: {
        description: 'No `<script>` element holds executable code inline.',
        why: 'A Content Security Policy without `unsafe-inline` blocks inline code, and a script file can be cached and checked.',
        fix: 'Put the code in a `.js` file, and load it with `<script src="...">`.',
        example: '`<script>start();</script>` reports `inline-script`; `<script src="/start.js"></script>` does not.',
    },
    [HTML_RULES.handlerAttribute]: {
        description: 'No element has an event handler attribute, such as `onclick`.',
        why: 'A handler attribute is inline script, which a strict Content Security Policy blocks.',
        fix: 'Call `addEventListener` in a script file, and remove the attribute.',
        example: '`<button onclick="save()">` reports `handler-attribute`.',
    },
    [HTML_RULES.scriptLink]: {
        description: 'No URL attribute runs code through a `javascript:` URL or a `data:` URL of a script or a page.',
        why: 'The URL runs code that a Content Security Policy and a reviewer cannot see as a file.',
        fix: 'Load the code from a script file, and link to a real page.',
        example: '`<a href="javascript:save()">` reports `script-link`.',
    },
} as const satisfies RuleExplanations;
