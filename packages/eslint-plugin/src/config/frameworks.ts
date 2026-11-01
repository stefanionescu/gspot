export const COMPONENT_NAME = /^[^a-z]/u;

export const REACT_STATE_HOOK = 'react.useState';

export const GENERATED_KEY_CALLS = new Set(['Math.random', 'Date.now']);

export const LEAKING_TYPES = new Set(['number', 'bigint']);

export const NATIVE_LEAKING_TYPES = new Set(['number', 'bigint', 'string']);

export const VUE_CLASS_BASE = 'vue-class-component.Vue';

export const VUE_CLASS_DECORATORS = new Set([
    'vue-class-component',
    'vue-class-component.Component',
    'vue-class-component.Options',
]);

export const VUE_PROPERTY_DECORATORS = new Set([
    'vue-property-decorator.Prop',
    'vue-property-decorator.PropSync',
    'vue-property-decorator.Model',
    'vue-property-decorator.ModelSync',
    'vue-property-decorator.Watch',
    'vue-property-decorator.Provide',
    'vue-property-decorator.Inject',
    'vue-property-decorator.ProvideReactive',
    'vue-property-decorator.InjectReactive',
    'vue-property-decorator.Emit',
    'vue-property-decorator.Ref',
    'vue-property-decorator.VModel',
]);

export const UTILITY_LIBRARIES = new Map([
    ['lodash', { minimum: [4, 0, 0], example: 'lodash/map' }],
    ['lodash-es', { minimum: [4, 0, 0], example: undefined }],
    ['rxjs', { minimum: [7, 2, 0], example: undefined }],
    ['rambda', { minimum: [0, 8, 8], example: undefined }],
    ['validator', { minimum: [12, 1, 0], example: 'validator/es/lib/isEmail' }],
]);

export const MEMOIZE_FUNCTIONS = new Set(['lodash.memoize', 'lodash-es.memoize', 'underscore.memoize']);

export const JQUERY_GLOBALS = new Set(['jQuery', '$']);

export const JQUERY_ORIGINS = new Set(
    ['jquery', 'jquery.slim', 'jquery.dist.jquery.slim', 'jquery.dist.jquery.slim.js'].flatMap((module) => [
        module,
        `${module}.$`,
        `${module}.jQuery`,
    ]),
);

export const JQUERY_METHODS = new Map([
    ['isArray', { alternative: 'Array.isArray()', isDeprecated: true }],
    ['parseJSON', { alternative: 'JSON.parse()', isDeprecated: true }],
    ['now', { alternative: 'Date.now()', isDeprecated: true }],
    ['trim', { alternative: 'String.prototype.trim()', isDeprecated: true }],
    ['inArray', { alternative: 'Array.prototype.indexOf()', isDeprecated: false }],
]);

export const AXIOS_DEPRECATIONS = new Map([
    ['axios.all', { symbol: 'axios.all()', alternative: 'Promise.all()' }],
    ['axios.spread', { symbol: 'axios.spread()', alternative: 'array destructuring' }],
]);

export const AXIOS_CANCEL_TOKEN = 'axios.CancelToken';

export const AXIOS_CONFIG_POSITIONS = new Map([
    ['axios', [0, 1]],
    ['axios.request', [0]],
    ['axios.get', [1]],
    ['axios.delete', [1]],
    ['axios.head', [1]],
    ['axios.options', [1]],
    ['axios.post', [2]],
    ['axios.put', [2]],
    ['axios.patch', [2]],
]);

export const TIMER_FUNCTION = /^(?:lodash|lodash-es|underscore)[./](debounce|throttle)$/u;

export const TIMER_WORDS = new Map([
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
