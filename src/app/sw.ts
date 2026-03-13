/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // App page navigations — NetworkFirst with 3s timeout, cache fallback
    {
      matcher({ request, url }) {
        return (
          request.mode === "navigate" &&
          /^\/(groups|rides|profile)/.test(url.pathname)
        );
      },
      handler: new NetworkFirst({
        cacheName: "app-pages",
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 86400, // 24h
          }),
        ],
      }),
    },
    // Next.js static assets (JS/CSS) — immutable, CacheFirst
    {
      matcher({ url }) {
        return url.pathname.startsWith("/_next/static/");
      },
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          }),
        ],
      }),
    },
    // Strava avatar images — CacheFirst with 7-day expiry
    {
      matcher({ url }) {
        return url.hostname === "dgalywyr863hv.cloudfront.net";
      },
      handler: new CacheFirst({
        cacheName: "strava-avatars",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
    },
    // Fonts and other static assets — StaleWhileRevalidate
    {
      matcher({ request }) {
        return (
          request.destination === "font" ||
          request.destination === "style" ||
          request.destination === "image"
        );
      },
      handler: new StaleWhileRevalidate({
        cacheName: "static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    // Spread default cache as fallback for anything else
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
