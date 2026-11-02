export const COMPONENT_NAME = /^[^a-z]/u;

export const REACT_STATE_HOOK = 'react.useState';

export const GENERATED_KEY_CALLS = new Set(['Math.random', 'Date.now']);

export const LEAKING_TYPES = new Set(['number', 'bigint']);

export const NATIVE_LEAKING_TYPES = new Set(['number', 'bigint', 'string']);

export const TIMER_FUNCTION = /^(?:lodash|lodash-es|underscore)[./](debounce|throttle)$/u;

export const TIMER_WORDS: ReadonlyMap<string | undefined, Record<string, string>> = new Map([
    ['debounce', { kind: 'debounced', purpose: 'debouncing' }],
    ['throttle', { kind: 'throttled', purpose: 'throttling' }],
]);

export const STATEFUL_FUNCTION_NAME = /^(?:[A-Z]|use[A-Z])/u;

export const REACT_CLASS = /^(?:react\.|React\.)?(?:Pure)?Component$/u;

export const CACHING_HOOK = /^(?:react\.)?use(?:Memo|Callback)$/u;

export const REACT_REF_HOOK = 'react.useRef';

export const REF_GUARD = /^(?:!§|§===?null|null===?§)$/u;

export const SPACES = /\s+/gu;

export const CLASS_OUTPUT_METHOD =
    ':matches(ClassDeclaration, ClassExpression) > ClassBody > :matches(MethodDefinition, PropertyDefinition)[computed=false][static=false][key.name="render"] > :matches(FunctionExpression, ArrowFunctionExpression)';

export const COMPONENT_DECLARATION = 'FunctionDeclaration[id.name=/^[A-Z]/][params.length=1]';

export const JSX_NODE_PREFIX = 'JSX';

export const READONLY_UTILITY = 'Readonly';

export const READONLY_MAPPED = /^\{\s*(?:\+\s*)?readonly\s*\[/u;

export const READONLY_MEMBER =
    /^(?:(?:public|protected|private|static|declare|override|abstract)\s+)*(?:readonly|get)\s+[^\s:?(]/u;
