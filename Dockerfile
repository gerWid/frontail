FROM node:20-bookworm-slim

WORKDIR /frontail
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

ENTRYPOINT ["/frontail/docker-entrypoint.sh"]
EXPOSE 9001
CMD ["--help"]
