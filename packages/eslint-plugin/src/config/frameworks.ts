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
