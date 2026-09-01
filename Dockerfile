FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.9.2 --activate
COPY package.json .yarnrc.yml ./
RUN yarn install
COPY . .

ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY=""
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=${NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
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
