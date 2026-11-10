import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/** The cluster's pod and service networks. Every hop between the visitor and
 *  this process — Traefik, Kourier, the queue-proxy sidecar — has an address
 *  in here, so trusting the whole range walks `X-Forwarded-For` past all of
 *  them and stops at the first address that is not ours. A hop *count* would
 *  resolve the same address today and silently return the wrong one the day
 *  the chain gains or loses a hop: a failure that looks perfectly healthy. */
export const TRUSTED_PROXIES = ['loopback', '10.42.0.0/16', '10.43.0.0/16'];

/** Addresses that cannot identify a visitor: the cluster's own networks and
 *  loopback, in both plain and IPv4-mapped-IPv6 form. */
const INTERNAL = /^(?:::ffff:)?(?:10\.4[23]\.|127\.)|^::1$/;

export function isInternalAddress(ip: string | undefined): boolean {
  return !ip || INTERNAL.test(ip);
}

/** Counts pages only: the gallery, the purchase and legal pages, and the 404
 *  page (src/app.ts mounts the limiter after the static files, so pictures,
 *  the bundle, the fonts and the favicon cost nothing). A visit is the
 *  gallery plus however many purchase pages a person opens, a handful at
 *  most, so 300 per five minutes is far more than any person uses, while
 *  still leaving room for several tabs, an office behind one NAT, and
 *  carrier-grade NAT on mobile. It used to count every picture too, and one
 *  visit to the lobby cost about 28 of the 300.
 *
 *  The window is per key, not global: a hundred visitors on a hundred
 *  addresses each spend a sliver of their own budget and never meet.
 *  It is a fixed window, so a client straddling the reset can burst to twice
 *  the limit; for cached static art that is harmless, and the five-minute
 *  window already halves that burst against the equivalent 600-per-ten. */
export const WINDOW_MS = 5 * 60 * 1000;
export const LIMIT = 300;

let warned = false;

/** Guards against the one way this middleware could cause the outage it is
 *  meant to prevent. `req.ip` is only a visitor once `trust proxy` is set
 *  correctly; if it is not, it is the queue-proxy's address — the same value
 *  for everybody — and keying on it would put every visitor in one shared
 *  bucket, so a busy afternoon would 429 people who had loaded three pages.
 *  Rather than trust that the chain is what we think it is, refuse to limit
 *  at all when the address we resolved is one of ours. Failing open costs us
 *  nothing here and fails closed would cost us the site. It also exempts the
 *  readiness probe, which reaches /health from inside the cluster. */
export function shouldSkip(req: Request): boolean {
  if (!isInternalAddress(req.ip)) return false;
  if (!warned) {
    warned = true;
    console.warn(
      `ratelimit: resolved ${req.ip} for ${req.path} — an in-cluster address, ` +
      'so this request is not being limited. If external traffic logs this, ' +
      "`trust proxy` is not matching the real chain and nothing is limited.",
    );
  }
  return true;
}

/** A factory rather than a shared instance: the counters live in the
 *  middleware, so two apps in the same process — every test file builds its
 *  own — would otherwise spend one budget between them. */
export function galleryLimiter(limit: number = LIMIT) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
  });
}
