# Stage 1: Build an Angular Docker Image
# Pin Node — unpinned `FROM node` pulled Node 26 on a clean host and broke the
# build. Angular 21 supports Node 20 LTS.
FROM node:20 as build
WORKDIR /app
COPY package*.json /app/
# --legacy-peer-deps: the ladder upgrade moved @angular/cli to 21 while
# @angular-eslint/schematics is still 16 (peer-wants cli 16), so strict npm (v7+)
# fails to resolve. eslint is dev-only tooling and unused in the prod build.
RUN npm install --legacy-peer-deps
COPY . /app
ARG configuration=production
# --output-path (kebab): Angular 21's CLI rejects the old camelCase --outputPath
# ("Unknown argument: outputPath").
RUN npm run build -- --output-path=./dist/out --configuration $configuration
# Stage 2, use the compiled app, ready for production with Nginx
FROM nginx
COPY --from=build /app/dist/out/ /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]