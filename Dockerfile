FROM nginx:1.27-alpine

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html

RUN rm -rf \
    /usr/share/nginx/html/scripts \
    /usr/share/nginx/html/.githooks \
  && rm -f \
    /usr/share/nginx/html/.czbudget-canonical \
    /usr/share/nginx/html/.dockerignore \
    /usr/share/nginx/html/.gitignore \
    /usr/share/nginx/html/AGENTS.md \
    /usr/share/nginx/html/CANONICAL_SOURCE.md \
    /usr/share/nginx/html/Dockerfile \
    /usr/share/nginx/html/cloudbuild.yaml \
    /usr/share/nginx/html/nginx.conf.template

EXPOSE 8080
