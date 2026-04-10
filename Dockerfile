# syntax=docker/dockerfile:1.6
FROM node:20-alpine

LABEL org.opencontainers.image.source="https://github.com/jobmatchme/bee-pi-agent"

ARG BEE_PI_AGENT_PACKAGE=@jobmatchme/bee-pi-agent

RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    jq \
    curl \
    ripgrep \
    ca-certificates \
    tini

RUN addgroup -g 10001 -S app && adduser -S -D -H -u 10001 -G app -h /home/app app

RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm install -g --ignore-scripts "${BEE_PI_AGENT_PACKAGE}"

WORKDIR /workspace
RUN mkdir -p /home/app /workspace /var/run/bee && chown -R 10001:10001 /home/app /workspace /var/run/bee

USER 10001:10001

ENV HOME=/home/app
ENV NODE_ENV=production
ENV BEE_PI_AGENT_SOCKET=/var/run/bee/worker.sock
ENV NODE_PATH=/usr/local/lib/node_modules/@jobmatchme/bee-pi-agent/node_modules

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bee-pi-agent"]
