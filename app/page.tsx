'use client';

import { useEffect, useState, useCallback } from 'react';
import WeatherCharts, { WeatherPoint, WeatherCurrent } from './WeatherCharts';

interface WeatherState {
  current: WeatherCurrent;
  timeline: WeatherPoint[];
}

function makePoint(
  offset: number,
  label: string,
  src: any,
  idx: number,
  fallback: { temp: number; feelsLike: number; humidity: number }
): WeatherPoint {
  return {
    timeOffset: offset,
    timeLabel: label,
    temperature: src?.temperature_2m?.[idx] ?? fallback.temp,
    feelsLike: src?.apparent_temperature?.[idx] ?? fallback.feelsLike,
    humidity: src?.relative_humidity_2m?.[idx] ?? fallback.humidity,
    precipitation: src?.precipitation?.[idx] ?? 0,
  };
}

function buildTimeline(current: WeatherCurrent, data: any, now: Date): WeatherPoint[] {
  const points: WeatherPoint[] = [];
  const mTimes: string[] = data.minutely_15?.time ?? [];
  const hTimes: string[] = data.hourly?.time ?? [];

  function findClosestIndex(targetTime: number, times: string[]): number {
    if (times.length === 0) return 0;
    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const diff = Math.abs(new Date(times[i]).getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      } else if (diff > minDiff) {
        break;
      }
    }
    return bestIdx;
  }

  const nowMs = now.getTime();

  // Point 0: Current conditions (Now)
  points.push({
    timeOffset: 0,
    timeLabel: 'Now',
    temperature: current.temp,
    feelsLike: current.feelsLike,
    humidity: current.humidity,
    precipitation: current.precip ?? 0,
  });

  // Granular 15-minute forecast over the next hour
  let first15 = Math.ceil(nowMs / (15 * 60000)) * (15 * 60000);
  if (first15 - nowMs < 3 * 60000) {
    first15 += 15 * 60000;
  }

  let curr = first15;
  while (curr - nowMs <= 75 * 60000) {
    const d = new Date(curr);
    const offset = Math.round((curr - nowMs) / 60000);
    const label = d.getMinutes() === 0
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
      : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/ (AM|PM)/, '');

    const idxM = findClosestIndex(curr, mTimes);
    points.push(makePoint(offset, label, data.minutely_15, idxM, current));
    curr += 15 * 60000;
  }

  // Clock hours at true time offset out to ~6.5 hours
  const usedOffsets = new Set(points.map((p) => p.timeOffset));
  const lastGranularOffset = points[points.length - 1].timeOffset;
  const startHourDate = new Date(nowMs);
  startHourDate.setMinutes(0, 0, 0);

  for (let h = 1; h <= 8; h++) {
    const hourDate = new Date(startHourDate.getTime() + h * 3600000);
    const offset = Math.round((hourDate.getTime() - nowMs) / 60000);
    if (offset >= lastGranularOffset + 10 && offset <= 390 && !usedOffsets.has(offset)) {
      const label = hourDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      const idxH = findClosestIndex(hourDate.getTime(), hTimes);
      points.push(makePoint(offset, label, data.hourly, idxH, current));
      usedOffsets.add(offset);
    }
  }

  return points;
}

const TRANSIT_PANELS = [
  {
    title: 'Blue Line',
    getUrl: () =>
      'https://www.transitchicago.com/traintracker/popout.aspx?bg=y&sort=time&results=6&fx=y&sid=40590&hideoptions=y&size=small',
  },
  {
    title: 'Northwest',
    getUrl: (refresh: number | null) => {
      const base = `https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=8929,945,15847&bgcolor=335f4c&slidename=${encodeURIComponent('North/West (Away from city)')}&size=small`;
      return refresh ? `${base}&date=${refresh}` : base;
    },
  },
  {
    title: 'Southeast',
    getUrl: (refresh: number | null) => {
      const base = `https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=8849,898,5481&bgcolor=5f333b&slidename=${encodeURIComponent('South/East (City center)')}&size=small`;
      return refresh ? `${base}&date=${refresh}` : base;
    },
  },
];

export default function Home() {
  const refreshInterval = 60 * 1000;

  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(true);
  const [currTime, setCurrTime] = useState<number | null>(null);
  const [lastWeatherUpdate, setLastWeatherUpdate] = useState<number | null>(null);

  const getWeather = useCallback(async () => {
    try {
      const lat = process.env.NEXT_PUBLIC_LATITUDE || '';
      const lon = process.env.NEXT_PUBLIC_LONGITUDE || '';
      const query = lat && lon ? `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` : '';

      const res = await fetch(`/api/weather/forecast${query}`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();

      const current: WeatherCurrent = {
        temp: data.current.temperature_2m,
        feelsLike: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        precip: data.current.precipitation,
        code: data.current.weather_code,
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        isDay: data.current.is_day === 1,
      };

      setWeather({
        current,
        timeline: buildTimeline(current, data, new Date()),
      });
      setLastWeatherUpdate(Date.now());
      setWeatherBusy(false);
    } catch (err) {
      console.error('Weather error:', err);
      setWeatherBusy(false);
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    setCurrTime(now);
    setLastWeatherUpdate(now);
    getWeather();

    const weatherTimer = setInterval(getWeather, refreshInterval);
    const clockTimer = setInterval(() => {
      setCurrTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(weatherTimer);
      clearInterval(clockTimer);
    };
  }, [getWeather, refreshInterval]);

  const elapsed = currTime && lastWeatherUpdate ? Math.max(0, currTime - lastWeatherUpdate) : 0;
  const countdown = Math.max(0, Math.ceil((refreshInterval - elapsed) / 1000));
  const nextRefresh = lastWeatherUpdate ? lastWeatherUpdate + refreshInterval : null;

  return (
    <main>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: '40dvh 60dvh',
          gridTemplateColumns: '22dvw 39dvw 39dvw',
          width: '100dvw',
          height: '100dvh',
          margin: 0,
          padding: 0,
          backgroundColor: '#121212',
          overflow: 'hidden',
        }}
      >
        {/* Top Row: Weather Section (40dvh) */}
        <div
          style={{
            gridColumn: '1 / -1',
            borderBottom: '1px solid #27272a',
            overflow: 'hidden',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
          suppressHydrationWarning
        >
          {weatherBusy && !weather ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: 16, color: '#a1a1aa' }}>
              Loading weather...
            </div>
          ) : weather ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <WeatherCharts
                timeline={weather.timeline}
                current={weather.current}
                currTime={currTime}
                countdown={countdown}
                lastWeatherUpdate={lastWeatherUpdate ?? 0}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: 14, color: '#f87171', padding: 16, textAlign: 'center' }}>
              Weather data unavailable. Checking connection...
            </div>
          )}
        </div>

        {/* Bottom Row: 3 Transit Panels (60dvh) */}
        {TRANSIT_PANELS.map((panel, idx) => (
          <div
            key={panel.title}
            style={{
              borderRight: idx === TRANSIT_PANELS.length - 1 ? 'none' : '1px solid #27272a',
              overflow: 'hidden',
              height: '100%',
              boxSizing: 'border-box',
            }}
            suppressHydrationWarning
          >
            <iframe
              src={panel.getUrl(nextRefresh)}
              style={{ width: '100%', height: '100%', overflow: 'hidden', border: 'none', scrollbarWidth: 'none' }}
              title={panel.title}
              scrolling="no"
              suppressHydrationWarning
            />
          </div>
        ))}
      </div>
    </main>
  );
}
