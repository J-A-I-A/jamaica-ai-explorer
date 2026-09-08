FROM node:22-alpine AS builder

WORKDIR /app

# The Yarn release is committed to .yarn/releases and pointed at by yarnPath in
# .yarnrc.yml, so the version here is whatever the repo is pinned to — corepack
# only needs to provide the shim that hands off to it.
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
# --immutable: build on the committed lockfile and fail if it is out of date,
# rather than silently resolving different transitive versions than local.
RUN yarn install --immutable
COPY . .

# No build arguments: every configuration value this app needs is read from the
# environment at runtime, so one image can be promoted across environments.
RUN yarn build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV MODEL_API_KEY="" \
	OPENAI_API_KEY="" \
	OPENAI_BASE_URL="" \
	MODEL="" \
	MODEL_MAX_TOKENS="4096" \
	CHAT_RATE_LIMIT="15" \
	CHAT_RATE_WINDOW_HOURS="24" \
	RECAPTCHA_SITE_KEY="" \
	RECAPTCHA_SECRET_KEY="" \
	POSTGRES_URL="" \
	POSTGRES_USER="" \
	POSTGRES_PASSWORD="" \
	POSTGRES_SSL="" \
	POSTGRES_POOL_MAX="3"

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
