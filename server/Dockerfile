# The API as one container. Build from the repo root (it's an npm workspace):
#   docker build -f server/Dockerfile -t conceptquery-api .
#   docker run --env-file server/.env -p 4000:4000 conceptquery-api
# Works on x64 and ARM (e.g. Oracle Cloud's free Ampere VMs): every native
# dependency (sharp, canvas, argon2, onnxruntime) ships prebuilt binaries for both.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server
COPY server/ server/
RUN npm run build --workspace server

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY server/data server/data

# Download the embedding model now, so a new container answers its first search without fetching it.
WORKDIR /app/server
RUN node --input-type=module -e "import { env, pipeline } from '@huggingface/transformers'; env.cacheDir = '/app/server/.model-cache/'; await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8' });"

# Ingestion (OCR, tagging) runs on a developer machine against the same database; this container only serves.
ENV RUN_WORKER=false PORT=4000
EXPOSE 4000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>r.json()).then(j=>process.exit(j.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/index.js"]
