# Stage 1: Build an Angular Docker Image
# Pin Node — unpinned `FROM node` pulled Node 26 on a clean host and broke the
# build. Angular 21 supports Node 22 LTS and Node 20 is end of life.
FROM node:22 as build
WORKDIR /app
COPY package*.json /app/
RUN npm ci
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