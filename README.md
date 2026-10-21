# OSW — Open Small Weather

All project files are in this one directory:

- `index.html` — GitHub Pages dashboard
- `worker.js` and `wrangler.toml` — Cloudflare Worker
- `osw_esp32.ino` — ESP32 DHT22 publisher
- `secrets.example.h` — copy to `secrets.h` locally; never commit it

The frontend is uploaded to GitHub Pages. The Worker is deployed separately with Wrangler and keeps the Adafruit IO Active Key in an encrypted Cloudflare secret. Do not place that key in GitHub or `index.html`.

Before deploying the Worker, replace only the placeholder public feed keys and allowed origin with verified values, or preserve the existing Cloudflare bindings. The Worker target is `osw-weather-api`.
