# Coolify migration — betting UI (`bettingui.work.gd`)

Copy this file into the betting UI repository and apply the changes below. Coolify on the **same VPS** already routes `https://lotmdnd.work.gd` to the LOTM app (port 3001). This site stays on **port 3000**.

## Why this change

The previous Linode workflow:

1. SSH’d into the VPS
2. Ran `docker compose` with a host-published nginx on port 80 (or 8080)
3. Installed `/etc/nginx/sites-available/bettingui` and reloaded **host nginx**

Coolify’s Traefik/Caddy must own **80/443** for both domains. Host nginx and published container port 80 will steal those ports or 502 one of the two sites.

After this migration, GitHub Actions only **builds GHCR** and **calls the Coolify deploy webhook**. Coolify pulls the image and routes `bettingui.work.gd` → container `:3000`.

## 1. Stop fighting Coolify for ports

On the VPS, **before** or as part of the first Coolify deploy:

```bash
sudo systemctl stop nginx || true
sudo systemctl disable nginx || true
sudo rm -f /etc/nginx/sites-enabled/bettingui /etc/nginx/sites-available/bettingui
sudo rm -f /etc/nginx/conf.d/bettingui.conf
cd "$HOME/bettingui" && docker compose down --remove-orphans || true
```

Leave Coolify’s own stack running (`coolify`, `coolify-proxy`, etc.).

## 2. Replace `docker-compose.yml`

Remove the `nginx` service, host `ports`, and `container_name`. Coolify connects to the Next.js process directly.

```yaml
# Coolify: domain https://bettingui.work.gd → service app port 3000
# Do not publish 80/443. Do not run a sidecar nginx.

services:
  app:
    image: ${BETTINGUI_IMAGE:-ghcr.io/<owner>/<repo>:latest}
    pull_policy: always
    restart: unless-stopped
    shm_size: "1gb"
    expose:
      - "3000"
    environment:
      NODE_ENV: production
      HOSTNAME: 0.0.0.0
      PORT: "3000"
      CHROME_PATH: /usr/bin/chromium
      CHROME_NO_SANDBOX: "1"
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 40s
```

Do not put `build: .` in `docker-compose.yml` — Coolify will compile Chromium + Next.js on the VPS. Production compose should only `image:` + `pull_policy: always`. Local builds use `docker-compose.local.yml`. In Coolify, set `BETTINGUI_IMAGE` to the GHCR tag GitHub Actions pushes.

Optional: add a named volume if the app writes uploads or a SQLite file under `/app` — map that path explicitly so redeploys do not wipe it.

## 3. Dockerfile

No Coolify-specific change required if it already listens on `0.0.0.0:3000`. Confirm:

- `HOSTNAME=0.0.0.0` (not `127.0.0.1`)
- `EXPOSE 3000`
- Healthcheck hits `http://127.0.0.1:3000/`

Leave Chromium in the image if live scrape still needs it.

## 4. nginx files

You can keep `nginx/default.conf` and `nginx/host.conf` in git as a non-Coolify fallback, but **do not install `host.conf` on the VPS**.

If you ever run without Coolify again:

- `server_name bettingui.work.gd;`
- `proxy_pass` to `127.0.0.1:<app-port>` where compose published the **app** (3000), not a nested nginx.

With Coolify, Traefik already does TLS and gzip. Sidecar nginx is unused.

## 5. Replace `.github/workflows/deploy.yml`

Delete the Linode SSH / SCP / host-nginx steps (`LINODE_HOST`, `appleboy/ssh-action`, `install_host_nginx_proxy`). Use GHCR + Coolify webhook:

```yaml
name: Deploy to Coolify

on:
  push:
    branches:
      - main

concurrency:
  group: deploy-bettingui
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set lowercase image name
        run: echo "IMAGE_NAME=ghcr.io/$(echo '${{ github.repository }}' | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_ENV"

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          platforms: linux/amd64
          tags: |
            ${{ env.IMAGE_NAME }}:latest
            ${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Trigger Coolify deployment
        if: ${{ secrets.COOLIFY_WEBHOOK }}
        env:
          COOLIFY_WEBHOOK: ${{ secrets.COOLIFY_WEBHOOK }}
          COOLIFY_TOKEN: ${{ secrets.COOLIFY_TOKEN }}
        run: |
          set -eu
          if [ -n "${COOLIFY_TOKEN:-}" ]; then
            curl --fail --show-error --request POST "$COOLIFY_WEBHOOK" \
              --header "Authorization: Bearer $COOLIFY_TOKEN"
          else
            curl --fail --show-error --request POST "$COOLIFY_WEBHOOK"
          fi
```

GitHub secrets on the **betting UI** repo (different webhook UUID from LOTM):

| Secret | Purpose |
| --- | --- |
| `COOLIFY_WEBHOOK` | This Coolify resource’s Deploy Webhook |
| `COOLIFY_TOKEN` | If the webhook requires a Bearer token |

Remove `LINODE_HOST`, `LINODE_USER`, `LINODE_SSH_PRIVATE_KEY` from this repo once Coolify deploys succeed. Remove repository variable `LINODE_APP_PORT`.

## 6. Coolify resource (betting UI)

1. Same Coolify **project** as LOTM, **New Resource → Docker Compose**.
2. Connect the betting UI GitHub repo, branch `main`, compose file `docker-compose.yml`.
3. Domain: `https://bettingui.work.gd` → service `app` → port **3000**.
4. Env: `BETTINGUI_IMAGE=ghcr.io/<owner>/<repo>:latest`.
5. Disable **Auto Deploy on git push** if Actions already triggers the webhook (avoids a double build).
6. On the server: `docker login ghcr.io` with a PAT that can `read:packages` for this image.

## 7. DNS

A record `bettingui.work.gd` → same VPS IPv4 as `lotmdnd.work.gd`. Coolify issues Let’s Encrypt once port 80 reaches its proxy.

## 8. Checklist

- [ ] Host nginx stopped; Coolify proxy listens on 80/443
- [ ] Compose has no `ports:` on 80/443 and no `nginx` service
- [ ] Coolify domain port is **3000**, not 80
- [ ] GitHub Action pushes GHCR then hits **this app’s** webhook
- [ ] `https://bettingui.work.gd` loads; `https://lotmdnd.work.gd/health` still returns ok
- [ ] Old `$HOME/bettingui` compose stack is `down` so it cannot bind 8080/80 anymore
