# node:22-alpine — Alpine 3.24.4, ships zlib 1.3.2-r1 (fixes CVE-2026-85091).
# Re-resolve with `crane digest node:22-alpine` when bumping.
FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS deps                                                                                           
  WORKDIR /app                                                                                                          
  RUN corepack enable && corepack prepare pnpm@12.10.1 --activate                                                        
  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./                                                                                   
  RUN pnpm install --frozen-lockfile                                                                                    
                                                                                                                        
  FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS build                                                                                          
  WORKDIR /app                                                                                                          
  RUN corepack enable && corepack prepare pnpm@12.10.1 --activate       
  RUN apk add --no-cache curl \
  && curl -sSL https://github.com/bufbuild/buf/releases/latest/download/buf-Linux-x86_64 \
  -o /usr/local/bin/buf \
  && chmod +x /usr/local/bin/buf                                                 
  COPY --from=deps /app/node_modules ./node_modules                                                                     
  COPY . .                              
  RUN --mount=type=secret,id=buf_token \
      export BUF_TOKEN="$(cat /run/secrets/buf_token)" \
      && pnpm build                                                                                                        
                                                                                                                        
  FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
  COPY --from=build /app/node_modules ./node_modules                                                                    
  COPY --from=build /app/dist ./dist
  COPY --from=build /app/package.json ./package.json
  COPY --from=build /app/src/temp-protos ./temp-protos
  COPY --from=build /app/src/schema.gql ./src/schema.gql
  RUN chown -R appuser:appgroup /app/src
  USER appuser                                                                                                          
  EXPOSE 8081                                                                                                           
  EXPOSE 50051                                                                                                          
  CMD ["node", "dist/main.js"]
