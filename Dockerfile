FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS node-runtime

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

COPY --from=node-runtime /usr/local/ /usr/local/

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html
COPY server /app/server
COPY server/start.sh /app/start.sh

RUN rm -rf \
    /usr/share/nginx/html/scripts \
    /usr/share/nginx/html/.githooks \
    /usr/share/nginx/html/server \
  && rm -f \
    /usr/share/nginx/html/.czbudget-canonical \
    /usr/share/nginx/html/.dockerignore \
    /usr/share/nginx/html/.gitignore \
    /usr/share/nginx/html/AGENTS.md \
    /usr/share/nginx/html/CANONICAL_SOURCE.md \
    /usr/share/nginx/html/PUBLIC_DOMAIN_DEPLOYMENT.md \
    /usr/share/nginx/html/Dockerfile \
    /usr/share/nginx/html/cloudbuild.yaml \
    /usr/share/nginx/html/nginx.conf.template \
  && apk add --no-cache libstdc++ \
  && chmod 0555 /app/start.sh \
  && node --version

EXPOSE 8080

CMD ["/app/start.sh"]
