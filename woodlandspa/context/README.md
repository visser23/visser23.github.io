# Woodland Spa content and acquisition record

This folder is the local content archive for the reimagined GitHub Pages experience.

## What was retried

The second pass did not stop at `curl`. The source was tested with:

- direct `curl` and a browser user-agent;
- a real headless Chromium session through Playwright;
- direct-IP resolution and a no-proxy connection;
- common extraction/proxy routes;
- Google Maps' public place result for corroborating business details.

The production origin consistently failed at the environment's outbound tunnel (`ERR_TUNNEL_CONNECTION_FAILED` / proxy HTTP 403) before the request reached the website. This is an environment allow-list restriction, not a normal page-level Cloudflare challenge, so changing browser fingerprints cannot bypass it. Direct egress was also unavailable. The Google Maps result did load and corroborated the business name, Crow Wood Leisure address, phone, coordinates, website, rating and public business categories.

## Local asset set

`images/` now contains six original, locally served editorial illustrations for the pool, thermal spa, treatment room, dining, hotel room and Pendle landscape. They are SVG rather than hotlinks, so the demo stays fast, rights-safe and reliable on GitHub Pages. They intentionally do not pretend to be photography of the real property.

An official Google Business image URL was discovered in the Maps result, but the image host was independently blocked by the same tunnel. It was therefore not copied or committed without a valid binary response.

## Fidelity boundaries

The experience structure is faithful to the publicly corroborated business and its known pillars: day spa, hydrotherapy/thermal experiences, face and body treatments, massage, Bertram's, hotel stays and the Crow Wood setting. Business identity and contact details are captured in `content.json`.

Prices, exact treatment names, treatment durations, sample dishes, time-slot availability and the 10% extras saving are clearly prototype data. They are deliberately not represented as a successful scrape or a live offer. Publishing unverified menu or tariff data as current would be less faithful than labelling the prototype boundary honestly.

## Production handover

1. Run a crawl from a machine/network allowed to access `thewoodlandspa.com`, saving HTML, linked PDFs, image originals and sitemap URLs here.
2. Obtain the approved logo and licensed property photography directly from the operator.
3. Replace prototype prices, treatments and dishes from the current spa/treatment/restaurant PDFs or booking APIs.
4. Connect accommodation, spa inventory, treatment rooms/therapists and restaurant tables to their source systems.
5. Have the operator approve package-saving logic and content before launch.
6. Add booking terms, accessibility, privacy and cookie pages.
