# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim

WORKDIR /workspace
RUN corepack enable

COPY infra/container-entrypoint.sh /usr/local/bin/container-entrypoint.sh
RUN chmod +x /usr/local/bin/container-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/container-entrypoint.sh"]
