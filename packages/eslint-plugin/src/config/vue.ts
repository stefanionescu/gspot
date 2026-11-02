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

export const VUE_REF = 'vue.ref';

export const VUE_REACTIVE = 'vue.reactive';

export const VUE_ON_UPDATED = 'vue.onUpdated';

export const VUE_DEFINE_COMPONENT = 'vue.defineComponent';

export const VUE_OPTION_PROPERTIES =
    'ExportDefaultDeclaration > ObjectExpression > Property, CallExpression > ObjectExpression > Property';

export const GUARD_TESTS = new Map([
    ['IfStatement', 'test'],
    ['ConditionalExpression', 'test'],
    ['LogicalExpression', 'left'],
]);

export const TERMINATING_STATEMENTS = new Set<string | undefined>([
    'ReturnStatement',
    'ThrowStatement',
    'BreakStatement',
    'ContinueStatement',
]);

export const VOLATILE_CALLS = new Set(['Date.now', 'Math.random', 'performance.now']);
