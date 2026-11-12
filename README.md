# Nowy Żmigród Dragon Trail · mapa tras

Interaktywna mapa tras 30k i 10k: MapLibre GL JS 6, domyślny turystyczny podkład OpenTopoMap i wektorowe szlaki OpenStreetMap, dodatkowy podkład OpenFreeMap, ortofotomapa GUGiK, model terenu 3D i zsynchronizowany z mapą profil wysokości. Aplikacja statyczna, bez backendu, kont użytkowników i kluczy API. Przy braku WebGL2 automatycznie działa mapa 2D Leaflet z tym samym podkładem turystycznym i szlakami; profile, filtry i GPX pozostają dostępne.

## Uruchomienie

Node.js 22+:

```sh
npm ci
npm run dev
```

`npm run build` tworzy katalog `dist/`; można go udostępnić dowolnym serwerem statycznym. `npm run preview` uruchamia lokalny podgląd kompilacji. Nie otwieraj index.html przez file://.

## Testy

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

W środowisku z własnym Chromium ustaw `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`. Testy E2E wymagają dostępu do zewnętrznego podkładu mapowego. Testy jednostkowe nie korzystają z sieci.

## Dane

- `public/data/routes.geojson`: LineString z `properties.id` = `30k` / `10k`, współrzędne WGS84 `[lon, lat, wysokość_m]`.
- `public/data/points.geojson`: punkty z `name`, `type` (`food`, `road`, `issue`, `start`), opcjonalnie `route`, `km`, `roadNumber`, `description`.
- `public/data/roads.geojson`: wyróżnione odcinki drogowe.
- `public/data/provenance.json`: pochodzenie geometrii i ograniczenia dokładności.
- `public/data/30k.gpx`, `10k.gpx`: pobieralne ślady odpowiadające geometrii aplikacji.

Dystanse są liczone po geometrii, a nie po nazwie marketingowej. Sumy podejść są liczone z progiem 3 m; mogą różnić się od zegarka lub innych systemów. Przebieg po odzyskaniu z dokumentu nie jest nowym pomiarem GPS. Szczegółowa proweniencja jest zapisana przy danych.

Dane tras i oznaczeń aktualizuj razem. Nie przesuwaj punktów na podstawie samej nazwy miejsca. Brakujące wysokości nie są zastępowane zmyślonym profilem.

## Podkłady i usługi

- OpenTopoMap: rzeźba terenu, poziomice, drogi i ścieżki; © OpenStreetMap, SRTM, OpenTopoMap (CC-BY-SA 3.0), https://opentopomap.org/about.
- Szlaki piesze: lokalny wycinek OSM przez API Waymarked Trails, ODbL 1.0, stan 12.11.2026. 11 relacji w public/data/hiking-routes.geojson; kolory z colour/osmc:symbol, nie kolory hierarchii sieci. Bez wielkich symboli i etykiet; linie 1,8 px. Źródło i numery relacji zapisane w GeoJSON.
- OpenFreeMap Liberty: wektorowe kafle OpenStreetMap, atrybucja zachowana w mapie.
- GUGiK: ortofotomapa WMTS, wyłącznie po wybraniu tej warstwy.
- Mapzen / AWS Open Data Terrain Tiles (Terrarium): model terenu włączany opcją 3D. Publiczna usługa bez gwarancji dostępności; dla większego ruchu warto skonfigurować własnego dostawcę DEM.

Zewnętrzne usługi otrzymują żądania mapy (adres IP i obszar oglądania). Nie ma analityki ani telemetrii aplikacji. Publiczne podkłady mogą mieć ograniczenia dostępności; aplikacja pokazuje błąd zamiast udawać pełne wczytanie.

## Publikacja

GitHub Actions buduje i publikuje `main` na GitHub Pages: https://methyl.github.io/dragon-trail-map/. W ustawieniach repo → Pages wybierz Source: GitHub Actions. Repozytorium, opublikowana mapa i dane GPX są publiczne. `base` jest ustawione na `/dragon-trail-map/`.
