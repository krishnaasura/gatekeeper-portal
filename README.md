# Gatekeeper Portal

The terminal-style frontend for the Foehammer homelab. Includes a procedural static/terminal/skull startup, synthesized audio, a dense interactive ASCII banner, and animated application tiles. All animation is rendered in code; no video is required.

## Run locally

```sh
npm ci
npm run dev
```

Audio starts automatically when browser autoplay rules permit. Otherwise the next pointer or keyboard interaction unlocks it. Replay boot, mute, skip, reduced motion, and the motion toggle are supported.

## App connections

The browser reads `/api/connections`; addresses stay configured on the server. Preserve these existing environment variables when replacing the container:

| Variable | Purpose |
| --- | --- |
| `ARGOCD_URL` | Browser launch address for Argo CD; use its working public base URL |
| `ARGOCD_CHECK_URL` | Optional internal Argo probe address |
| `HEADLAMP_URL` | Browser launch address for Headlamp, including `/c/main` where appropriate |
| `HEADLAMP_CHECK_URL` | Optional internal Headlamp probe address |
| `PRICE_SCOUT_ORIGIN` | Internal Price Scout origin, used for health checks and the `/price-scout` proxy |
| `NODE_EXTRA_CA_CERTS` | Existing certificate bundle for trusted internal HTTPS, if required |

Argo CD and Headlamp keep their own authentication. The portal does not store credentials. Missing endpoints leave the corresponding launch button disabled.

## Container deployment

```sh
docker build --build-arg PRICE_SCOUT_ORIGIN=http://price-scout.default.svc.cluster.local:8091 -t YOUR_IMAGE_TAG .
```

The Price Scout rewrite is baked into the Next.js build, so supply its deployment origin at image build time as well as runtime. Keep the current Kubernetes environment settings, certificate mounts, Services, gateway routes, and Price Scout data volume.

The current homelab uses locally imported images and manually synced manifests in the separate `foehammer-gitops` repository. A source push here does not build or deploy an image automatically. Build/import a new image, update the Gatekeeper image tag in GitOps, and sync its application to publish an update.

## Validation

```sh
npm run lint
npm run build -- --webpack
node --experimental-strip-types --test tests/connections.test.mjs
```
