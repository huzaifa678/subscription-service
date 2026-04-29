FROM node:22-alpine AS deps                                                                                           
  WORKDIR /app                                                                                                          
  RUN corepack enable && corepack prepare pnpm@latest --activate                                                        
  COPY package.json pnpm-lock.yaml ./                                                                                   
  RUN pnpm install --frozen-lockfile                                                                                    
                                                                                                                        
  FROM node:22-alpine AS build                                                                                          
  WORKDIR /app                                                                                                          
  RUN corepack enable && corepack prepare pnpm@latest --activate       
  RUN apk add --no-cache curl \
  && curl -sSL https://github.com/bufbuild/buf/releases/latest/download/buf-Linux-x86_64 \
  -o /usr/local/bin/buf \
  && chmod +x /usr/local/bin/buf                                                 
  COPY --from=deps /app/node_modules ./node_modules                                                                     
  COPY . .                              
  RUN pnpm build                                                                                                        
                                                                                                                        
  FROM node:22-alpine AS runtime                                                                                        
  WORKDIR /app                                                                                                          
  ENV NODE_ENV=production                                                                                               
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup                                                            
  COPY --from=build /app/node_modules ./node_modules                                                                    
  COPY --from=build /app/dist ./dist                                                                                    
  COPY --from=build /app/package.json ./package.json                                                                    
  USER appuser                                                                                                          
  EXPOSE 8081                                                                                                           
  EXPOSE 50051                                                                                                          
  CMD ["node", "dist/main.js"] 
