---
title: "nginx"
description: "nginx configuration: gixy for the security mistakes, and the server's own parser in a container for the rest."
---

nginx configuration: gixy for the security mistakes, and the server's own parser in a container for the rest.

Kind: tool.

## Tools

- gixy 0.2.53
- docker

## Generated configuration

- `.gspot/gixy.cfg`

## Checks

| Check                                                      | Stage  | What it finds                                                                                                                                     |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`nginx/gixy`](/reference/rules/nginx/gixy/)               | commit | Reads every nginx file for the mistakes that open a server: request forgery, path traversal through alias, header injection, a disclosed version. |
| [`nginx/config-test`](/reference/rules/nginx/config-test/) | push   | Runs nginx -t over every main configuration file inside the nginx image. It mounts a throwaway certificate and resolves the upstream names.       |

## Settings

- `tools.nginx.image`: The image nginx -t runs in; name the one the deployment uses.

## Rule files

- `tool/nginx/NGINX.md`
