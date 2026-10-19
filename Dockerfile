FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8093
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node auth ./auth
COPY --chown=node:node dist ./dist
USER node
EXPOSE 8093
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD node -e "fetch('http://127.0.0.1:8093/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
