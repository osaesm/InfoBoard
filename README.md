## Getting Started

1. Clone `https://www.github.com/osaesm/InfoBoard.git`

## The overall structure

InfoBoard is a Next.js 16 application that consolidates the dashboard GUI and API proxy into a single unified service:

- `gui/` contains the code for the Next.js GUI and internal Route Handlers
  - `gui/app/page.tsx` — Main dashboard layout (weather header, time-series charts, transit frames)
  - `gui/app/WeatherCharts.tsx` — Weather charts & current condition header
  - `gui/app/api/health/route.ts` — API health check endpoint (`GET /api/health`)
  - `gui/app/api/weather/forecast/route.ts` — Open-Meteo weather forecast proxy (`GET /api/weather/forecast`)
- `Dockerfile.gui` is the container definition for the application
- Environment variables:
  - `gui/.env.local` (or root `.env`):
    - `NEXT_PUBLIC_LATITUDE` / `LATITUDE`
    - `NEXT_PUBLIC_LONGITUDE` / `LONGITUDE`

## Running InfoBoard

1. To set up locally, `cd` into `gui/` and run `npm i`.
2. To run the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.
3. To test the API route handlers directly:
   - Health check: `curl http://localhost:3000/api/health`
   - Forecast: `curl "http://localhost:3000/api/weather/forecast?latitude=41.9095&longitude=-87.6778"`
4. Production build:
   ```bash
   npm run build
   npm start
   ```
