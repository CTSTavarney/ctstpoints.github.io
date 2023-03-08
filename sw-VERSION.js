'use strict';

/* Not Currently Used -- For future implementation of PWA offline functionality */

const latestCacheName = 'ctst-2023-03-08';

const cacheContent = [
/*    './',
    './index.html',
    './index.css',
    './index.js',
    './manifest.webmanifest',*/
];

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
    self.skipWaiting();
    e.waitUntil(
        caches.open(latestCacheName).then( (cache) => {
            return cache.addAll(cacheContent);
        })
    );
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activate');
    const preloadAvailable = 'navigationPreload' in self.registration;
    e.waitUntil(
        caches.keys().then( (cacheNameList) =>
            Promise.all([
                cacheNameList
                    .filter( (cacheName) => cacheName !== latestCacheName )
                    .map( (cacheName) => caches.delete(cacheName) ),
                self.clients.claim(),
                preloadAvailable ? self.registration.navigationPreload.enable() : true
            ])
        )
    );
});

const putInCache = (request, response) => {
    /*caches.open(latestCacheName).then( (cache) => {
        if (request.destination !== 'script' && response.status < 400) {
            cache.put(request, response);
        }
    } );*/
};

self.addEventListener('fetch', (e) => {    
    const url = e.request.url;

    e.respondWith(
        // First try the latest cache
        caches.open(latestCacheName).then( (cache) => cache.match(url) ).then( (cacheResponse) => {
            // If we get a response from the cache, return it
            if (cacheResponse) {
                return cacheResponse;
            }

            // Handle the preload Promise
            // Use Promise.resolve in case the browser does not implement e.preloadResponse,
            // which will be undefined
            return Promise.resolve(e.preloadResponse).then( (preloadResponse) => {
                if (preloadResponse) {
                    putInCache(e.request, preloadResponse.clone());
                    return preloadResponse;
                }

                return fetch(url).then( (fetchResponse) => {
                    putInCache(e.request, fetchResponse.clone());
                    return fetchResponse;
                });

            });
        })
        .catch( (error) => {
            console.log('sw.catch()', error);
            return new Response('Network Error', {
                status: 408,
                headers: { 'Content-Type': 'text/plain' },
            });
        })
    );
});
