export const ANSIBLE_CONFIG = '[defaults]\ninventory = inventory\n';

export const ANSIBLE_PLAYBOOK = `---
- name: Deploy the service
  hosts: all
  tasks:
    - name: Restart the service
      ansible.builtin.systemd:
        name: test
        state: restarted
`;

export const ANSIBLE_SANDBOX = {
    configurations: ['ansible'],
    files: { 'deploy/ansible.cfg': ANSIBLE_CONFIG, 'deploy/site.yml': ANSIBLE_PLAYBOOK },
} as const;

export const DOCKER_SANDBOX = {
    install: false,
    configurations: ['docker'],
    files: {
        'api/Dockerfile': `FROM node:22.11.0-bookworm-slim
WORKDIR /app
COPY package.json ./
USER node
HEALTHCHECK CMD ["node", "--version"]
CMD ["node", "index.js"]
`,
        'api/.dockerignore': `.git
node_modules
.env*
`,
        'api/compose.yml': `services:
    api:
        build: .
`,
        'api/package.json': `{
    "name": "example",
    "private": true
}
`,
    },
} as const;

export const DOCKER_CASES = [
    {
        check: 'docker/compose',
        files: {
            'api/compose.yml': `services:
    api:
        image: example/image
        bogus: true
`,
        },
        expected: { file: 'api/compose.yml', message: 'bogus' },
    },
];

export const ROOT_USER_DOCKERFILE = `FROM node:22.11.0-bookworm-slim
WORKDIR /app
USER root
HEALTHCHECK CMD ["node", "--version"]
CMD ["node", "index.js"]
`;

export const DEBIAN_DOCKERFILE = `FROM debian:12
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
USER 1000
`;

export const ALPINE_DOCKERFILE = `FROM alpine:3.20.3
RUN apk add --no-cache curl
USER 1000
`;

export const TRIVY_SCOPE_TABLES = `[[scope]]
path = "app"

[[scope]]
path = "app/child"

[[scope]]
path = "sibling"

[[ignore]]
check = "docker/trivy-config"
rule = "DS-0002"
paths = ["app/**"]
reason = "This test exercises scoped advisory exceptions."
`;

export const TRIVY_SCOPE_RESULTS = [
    { scope: '', status: 'failed' as const, files: ['Dockerfile'] },
    { scope: 'app', status: 'passed' as const, files: [] },
    { scope: 'app/child', status: 'passed' as const, files: [] },
    { scope: 'sibling', status: 'failed' as const, files: ['sibling/Dockerfile'] },
];

export const COMPOSITE_ACTION = `name: Greet
inputs:
    message:
        description: Message to print
        required: true
runs:
    using: composite
    steps:
        - shell: bash
          run: echo "\${{ inputs.message }}"
`;

export const CHECKOUT_WORKFLOW = `on: workflow_dispatch
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
        with:
          persist-credentials: false
`;

export const REQUIRED_INPUT_WORKFLOW = `on:
  workflow_call:
    inputs:
      greeting:
        type: string
        required: true
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`;

export const TEMPLATE_INJECTION_WORKFLOW = `on: pull_request
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ github.event.pull_request.title }}"
`;

export const NGINX_SERVER = `server {
    listen 443 ssl;
    include /etc/nginx/tls#local.conf;
    location / { proxy_pass "http://api:3000"; }
}
`;

export const NGINX_SCOPE_TABLES = `[tools.nginx]
image = "nginx:1.29.3-alpine@"
[[scope]]
path = "proxy"

configurations = []
[scope.tools.nginx]
image = "nginx:1.29.3-alpine"
`;

export const NGINX_INCLUDE_FILES = {
    'proxy/nginx.conf': 'events {}\nhttp { include "conf.d/*.conf"; }\n',
    'proxy/tls#local.conf': `ssl_certificate "/etc/nginx/ssl/server  certificate.pem"; ssl_certificate_key "/etc/nginx/ssl/server key.pem";
# include /outside/ignored.conf;
`,
    'proxy/unrelated.conf': 'include /outside/not-used.conf;\n',
} as const;

const OPENAPI_DOCUMENT = `openapi: 3.1.0
info:
    title: Test
    version: 1.0.0
    description: The test service.
    contact:
        name: Owner
        url: https://example.test
servers:
    - url: https://example.test
tags:
    - name: health
paths:
    /health:
        get:
            operationId: readHealth
            description: Says the service is up.
            tags:
                - health
            responses:
                '204':
                    description: The service is up.
`;

export const OPENAPI_SANDBOX = {
    configurations: ['openapi'],
    without: ['vitest'],
    files: {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'openapi.yaml': OPENAPI_DOCUMENT,
    },
} as const;

export const OPENAPI_CASES = [
    {
        check: 'openapi/spectral',
        files: {
            'openapi.yaml': OPENAPI_DOCUMENT.replace('            operationId: readHealth\n', ''),
        },
        expected: { file: 'openapi.yaml', rule: 'operation-operationId', line: 15 },
    },
] as const;

export const XCODE_CASES = [
    {
        check: 'xcode/plutil',
        files: { 'app/Info.plist': '<plist><dict><key>A</key></plist>\n' },
        expected: { file: 'app/Info.plist' },
        corrected: {
            files: {
                'app/Info.plist':
                    '<?xml version="1.0"?><plist version="1.0"><dict><key>A</key><string>value</string></dict></plist>\n',
            },
        },
    },
] as const;

export const PLUTIL_UNREADABLE_FILES = ['missing.plist', 'private.plist'] as const;
