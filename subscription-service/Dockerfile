FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS deps                                                                                           
  WORKDIR /app                                                                                                          
  RUN corepack enable && corepack prepare pnpm@12.10.1 --activate                                                        
  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./                                                                                   
  RUN pnpm install --frozen-lockfile                                                                                    
                                                                                                                        
  FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build                                                                                          
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
                                                                                                                        
  FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runtime                                                                                        
  WORKDIR /app                                                                                                          
  ENV NODE_ENV=production                                                                                               
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup                                                            
  RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
  COPY --from=build /app/node_modules ./node_modules                                                                    
  COPY --from=build /app/dist ./dist                                                                                    
  COPY --from=build /app/package.json ./package.json                                                                  
  USER appuser                                                                                                          
  EXPOSE 8081                                                                                                           
  EXPOSE 50051                                                                                                          
  CMD ["node", "dist/main.js"] 
