# Qwen3.5-0.8B model server: production deployment

This folder deploys Alibaba's Qwen3.5-0.8B chat model on a CPU-only host in Docker and
exposes it through an OpenAI-compatible HTTP API. It serves question answering over the
Jamaica National A.I. Task Force Policy Recommendations report.

| | |
|---|---|
| API | OpenAI-compatible, under `/v1` (chat completions, streaming, tool calling, JSON mode) |
| Model name | `qwen3.5-0.8b` |
| Runtime | llama.cpp server, CPU only, one container |
| Weights | `unsloth/Qwen3.5-0.8B-GGUF:UD-Q4_K_XL`, a GGUF conversion of `Qwen/Qwen3.5-0.8B` (Apache 2.0) |
| Container port | 8080 |

**Status:** everything below was tested on a 12-thread development PC under Docker
Desktop. It has not yet been run on a production host, so repeat the verification and
benchmark steps on the target machine.

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | The whole deployment. There is no Dockerfile; the image is pulled prebuilt. |
| `.env.example` | Template for the production settings. Copy it to `.env`. |
| `bench_qa.py` | Load and tokens-per-second benchmark for question answering on the report. |
| `results/` | JSON reports written by each benchmark run. |

## Host requirements

- Linux x86-64 host with Docker Engine and the Compose plugin
- 6 or more CPU cores available to the container (the default uses 6 threads)
- 4 GB of RAM available; the container peaked at about 1.9 GB under load
- 2 GB of disk for the image and model files
- Outbound HTTPS to `ghcr.io` and `huggingface.co` for the first start only

No GPU is used or required.

## Deploy

1. Copy this folder to the host.
2. Create the settings file and edit it:

   ```bash
   cp .env.example .env
   ```

   At minimum, set `API_KEY` to a long random string, for example the output of
   `openssl rand -hex 32`. Keep `.env` out of version control.

3. Start the service. The first start downloads the image and about 1 GB of model files
   into the Docker volume `qwen35_models`.

   ```bash
   docker compose up -d
   docker compose logs -f     # wait for "listening on http://0.0.0.0:8080"
   ```

4. Verify it (replace `$API_KEY` with your key):

   ```bash
   curl http://127.0.0.1:8080/health
   # {"status":"ok"}

   curl http://127.0.0.1:8080/v1/chat/completions \
     -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
     -d '{"model":"qwen3.5-0.8b","messages":[{"role":"user","content":"Hello"}]}'
   ```

   A request without the key must return HTTP 401.

5. Set `OFFLINE=1` in `.env` and run `docker compose up -d` again. From then on the
   server starts from the cached model and makes no outbound requests.

6. Send one question through the application to warm the cache (see
   [Restarts and warm-up](#restarts-and-warm-up)).

## Settings

All settings live in `.env`. Apply changes with `docker compose up -d`.

| Variable | Default | Meaning |
|---|---|---|
| `API_KEY` | empty (no authentication) | Key clients send as `Authorization: Bearer <key>`. Several keys can be comma-separated. |
| `BIND_ADDRESS` | `127.0.0.1` | Host interface the port is published on. `0.0.0.0` listens on all interfaces. |
| `PORT` | `8080` | Host port. |
| `LLAMA_IMAGE` | `ghcr.io/ggml-org/llama.cpp:server` | Server image. Pin it to a digest in production. |
| `OFFLINE` | `0` | `1` forces use of the cached model and blocks downloads at start-up. |
| `MODEL` | `unsloth/Qwen3.5-0.8B-GGUF:UD-Q4_K_XL` | Hugging Face GGUF repository and quantisation. |
| `PARALLEL` | `4` | Requests processed at the same time. Extra requests queue. |
| `CTX_SIZE` | `32768` | Total context in tokens, split evenly across the slots (8,192 each by default). |
| `THREADS` | `6` | CPU threads used for inference. |

Each request's prompt plus answer must fit in one slot, `CTX_SIZE / PARALLEL` tokens. The
report prompt is about 5,100 tokens. If you raise `PARALLEL`, raise `CTX_SIZE` with it;
requests that do not fit fail with HTTP 500 "Context size has been exceeded".

Two behaviours are fixed in the `command:` list of `docker-compose.yml`:

- **Thinking mode is off.** With it on, this small model tends to spend its whole token
  budget reasoning and return an empty answer. A client can enable it for one request
  with `"chat_template_kwargs": {"enable_thinking": true}` and a large `max_tokens`.
- **Sampling defaults** follow the Qwen3.5 recommendations for non-thinking text
  (temperature 1.0, top-p 1.0, top-k 20, presence penalty 2.0). Clients can override them
  per request.

## Security

- **Set `API_KEY` before the port is reachable by anything you do not control.** With no
  key, the server accepts every request. With a key set, `/v1/*`, `/metrics` and `/slots`
  return 401 without it. `/health` stays open so health checks work.
- **The server speaks plain HTTP.** For any traffic that leaves the host, keep
  `BIND_ADDRESS=127.0.0.1` and put a TLS-terminating reverse proxy (nginx, Caddy, a cloud
  load balancer) in front of it. Only set `BIND_ADDRESS=0.0.0.0` on a trusted private
  network.
- **Do not expose it directly to browsers or the public internet.** The server allows
  cross-origin requests from any site and has no rate limiting. Have the application
  backend call it, and apply rate limits there or at the proxy.
- **Disable response buffering on the proxy** for `/v1/chat/completions`, otherwise
  streamed answers arrive all at once.
- **Pin the image.** `LLAMA_IMAGE` in `.env.example` is set to the digest this setup was
  tested with (llama.cpp build 11382, image dated 4 October 2026). The floating `:server`
  tag changes with every upstream release.

## Connecting the application

| Caller | Base URL |
|---|---|
| A process on the same host | `http://127.0.0.1:8080/v1` |
| Another container on the same host | `http://host.docker.internal:8080/v1` (on Linux, add `extra_hosts: ["host.docker.internal:host-gateway"]` to that container) |
| A service added to this compose file | `http://qwen:8080/v1` |
| Another machine | the reverse proxy's HTTPS address |

In any OpenAI client, set the base URL as above, the model to `qwen3.5-0.8b`, and the API
key to the value of `API_KEY`.

## Operations

### Health and monitoring

- `GET /health` returns `{"status":"ok"}` when the model is loaded. Docker also runs this
  check itself; `docker compose ps` shows the container as `healthy`.
- `GET /metrics` serves Prometheus metrics (token counts, prompt and generation time,
  requests in progress). It requires the API key when one is set.
- `docker compose logs -f` shows server logs. Docker's default log driver does not rotate
  them, so configure log rotation on the host or in the Docker daemon settings.

### Restarts and warm-up

The container restarts automatically after a crash or host reboot
(`restart: unless-stopped`).

After every restart, the first question takes about 28 to 30 seconds while the report
prompt is processed once. Later questions reuse that work and start answering in under a
second. Send one question after each deploy or restart so no user pays that cost.

### Updating and rolling back

```bash
# 1. Note the image currently in use, in case you need to roll back
docker inspect --format '{{.Config.Image}}' qwen35-0.8b

# 2. Set LLAMA_IMAGE in .env to the new digest, then
docker compose pull
docker compose up -d

# 3. Run the benchmark and compare with the previous results
python3 bench_qa.py --concurrency 4 --rounds 3
```

To roll back, set `LLAMA_IMAGE` back to the previous digest and run `docker compose up -d`.

The model files live in the `qwen35_models` volume and survive `docker compose down`.
`docker compose down -v` deletes them; with `OFFLINE=1` the server then cannot start until
you set `OFFLINE=0` for one start.

### Hosts without internet access

On a connected machine, run steps 1 to 3 of [Deploy](#deploy), then export the image with
`docker save` and the `qwen35_models` volume as an archive, and restore both on the target
host. Start it there with `OFFLINE=1`. This procedure has not been tested end to end.

## Capacity

Measured on 5 October 2026 on the development PC, default settings, report already cached,
20 questions per level:

| Simultaneous questions | Wait for first token (median) | Speed per user (median) | Full answer (median / 95th percentile) |
|---|---|---|---|
| 1 | 0.4 s | 18.8 tokens/s | 4.4 s / 6.6 s |
| 2 | 0.5 s | 13.2 tokens/s | 5.7 s / 9.6 s |
| 4 | 0.8 s | 6.9 tokens/s | 10.0 s / 21.1 s |
| 8 | 11.5 s | 6.8 tokens/s | 21.3 s / 29.8 s |

- Total output across all users tops out at roughly 18 to 24 tokens per second, so each
  extra simultaneous user slows the others.
- Four simultaneous questions is the practical ceiling. Beyond that nothing fails, but
  requests queue for 10 seconds or more.
- Answers average about 70 tokens, which works out to roughly 15 answered questions per
  minute at full load. This is an estimate from the measured throughput.
- To serve more users, run more hosts behind a load balancer. Raising `PARALLEL` alone
  only lengthens every answer, because the CPU is already saturated.

Rerun the benchmark on the production host; the numbers depend on its CPU.

### Running the benchmark

`bench_qa.py` needs Python 3 and nothing else. It sends the report as the system prompt,
asks ten fixed questions over the streaming API, and reports time to first token, prompt
and generation speed, and whether each answer contains the expected fact.

```bash
export API_KEY=...                              # if the server has a key set
python3 bench_qa.py                             # one user: cold first question, then cached
python3 bench_qa.py --concurrency 4 --rounds 3  # four simultaneous users
python3 bench_qa.py --no-cache                  # reprocess the report on every question
python3 bench_qa.py --min-gen-tps 15            # exit 1 if median generation speed is below 15
python3 bench_qa.py --base-url https://host/v1  # test through the reverse proxy
```

By default the report text is read from `../prompt-cache-tests/fixtures/system_prompt.txt`,
which is outside this folder. Copy that file to the host and pass its path with `--doc`.

## Known limitations

- **Answer quality.** At 0.8 billion parameters the model sometimes adds irrelevant or
  invented detail to otherwise correct answers. Tell users that answers can be wrong and
  point them to the report itself.
- **It does not reliably stay on topic.** Asked "What is the capital of France?" with a
  system prompt telling it to decline unrelated questions, it answered "Paris". If
  off-topic answers are unacceptable, filter them in the application.
- **The benchmark's answer check is a keyword match**, not an accuracy evaluation.
- **Third-party weights.** Qwen publishes this model only in Safetensors format, which
  llama.cpp cannot load, so the GGUF file comes from Unsloth's conversion. The download is
  not pinned to a revision; `OFFLINE=1` freezes whatever was downloaded first. To remove
  the dependency, convert `Qwen/Qwen3.5-0.8B` with llama.cpp's conversion tools, mount the
  file into the container, and load it with `--model` in place of `--hf-repo`. Do not use
  `Qwen/Qwen3.5-0.8B-Base`: it is the pre-trained-only model, intended for fine-tuning.
- **Single instance.** One container on one host, with no redundancy.
- **Image inputs are untested.** The vision projector loads with the model, but no image
  request has been tried.
