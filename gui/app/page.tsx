'use client'

import { useEffect, useState, useCallback } from 'react';
import WeatherCharts, { WeatherPoint } from './WeatherCharts';

interface WeatherState {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    precip: number;
    code: number;
    windSpeed: number;
    windDirection: number;
    isDay: boolean;
  };
  timeline: WeatherPoint[];
}

const BUS_STOPS = [
  { title: 'Northwest', stopId: '8929,945,15847', bg: '335f4c', name: 'North/West (Away from city)' },
  { title: 'Southeast', stopId: '8849,898,5481', bg: '5f333b', name: 'South/East (City center)' },
];

function buildTimeline(
  current: { temp: number; feelsLike: number; humidity: number; precip: number },
  data: any,
  now: Date
): WeatherPoint[] {
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
  // Skip the very next 15-min mark only if it's < 3 mins away (essentially already past)
  let first15 = Math.ceil(nowMs / (15 * 60000)) * (15 * 60000);
  if (first15 - nowMs < 3 * 60000) {
    first15 += 15 * 60000;
  }

  let curr = first15;
  while (curr - nowMs <= 75 * 60000) {
    const d = new Date(curr);
    const offset = Math.round((curr - nowMs) / 60000);
    const isHour = d.getMinutes() === 0;
    const label = isHour
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
      : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/ (AM|PM)/, '');

    const idxM = findClosestIndex(curr, mTimes);
    points.push({
      timeOffset: offset,
      timeLabel: label,
      temperature: data.minutely_15?.temperature_2m?.[idxM] ?? current.temp,
      feelsLike: data.minutely_15?.apparent_temperature?.[idxM] ?? current.feelsLike,
      humidity: data.minutely_15?.relative_humidity_2m?.[idxM] ?? current.humidity,
      precipitation: data.minutely_15?.precipitation?.[idxM] ?? 0,
    });
    curr += 15 * 60000;
  }

  // Clock hours at their true time offset out to ~6 hours from Now.
  // Build a set of offsets already emitted by the granular loop so we never
  // create a second data point (and therefore a second X-axis tick / label)
  // for the same clock hour — the main cause of "ghosted" hour labels.
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
      points.push({
        timeOffset: offset,
        timeLabel: label,
        temperature: data.hourly?.temperature_2m?.[idxH] ?? current.temp,
        feelsLike: data.hourly?.apparent_temperature?.[idxH] ?? current.feelsLike,
        humidity: data.hourly?.relative_humidity_2m?.[idxH] ?? current.humidity,
        precipitation: data.hourly?.precipitation?.[idxH] ?? 0,
      });
      usedOffsets.add(offset);
    }
  }

  return points;
}

export default function Home() {
  const refreshInterval = 60 * 1000;

  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(true);
  const [currTime, setCurrTime] = useState<number | null>(null);
  const [lastWeatherUpdate, setLastWeatherUpdate] = useState<number>(Date.now());

  const getWeather = useCallback(async () => {
    try {
      const lat = process.env.NEXT_PUBLIC_LATITUDE;
      const lon = process.env.NEXT_PUBLIC_LONGITUDE;
      const host = process.env.NEXT_PUBLIC_HOST_URL;
      if (!lat || !lon || !host) throw new Error('Missing environment variables');

      const res = await fetch(`${host}/weather/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();

      const now = new Date();

      const current = {
        temp: data.current.temperature_2m,
        feelsLike: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        precip: data.current.precipitation,
        code: data.current.weather_code,
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        isDay: data.current.is_day === 1,
      };

      const timeline = buildTimeline(current, data, now);

      setWeather({
        current,
        timeline,
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

  const iframeStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    border: 'none',
    scrollbarWidth: 'none',
  };

  const elapsed = currTime ? Math.max(0, currTime - lastWeatherUpdate) : 0;
  const countdown = Math.max(0, Math.ceil((refreshInterval - elapsed) / 1000));
  const nextRefresh = lastWeatherUpdate + refreshInterval;

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
        {/* Top Row: Weather Section (100% width, 40% height) */}
        <div
          style={{
            gridColumn: '1 / -1',
            borderBottom: '1px solid #27272a',
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
          suppressHydrationWarning
        >
          {weatherBusy && !weather ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: 16, color: '#a1a1aa' }}>Loading weather...</div>
          ) : weather ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <WeatherCharts
                timeline={weather.timeline}
                currentTemp={weather.current.temp}
                currentFeelsLike={weather.current.feelsLike}
                currentHumidity={weather.current.humidity}
                currentPrecip={weather.current.precip}
                currentWeatherCode={weather.current.code}
                currentWindSpeed={weather.current.windSpeed}
                currentWindDirection={weather.current.windDirection}
                isDay={weather.current.isDay}
                currTime={currTime}
                countdown={countdown}
                lastWeatherUpdate={lastWeatherUpdate}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: 14, color: '#f87171', padding: 16, textAlign: 'center' }}>Weather data unavailable. Checking connection...</div>
          )}
        </div>

        {/* Bottom Row: 3 Transit Quadrants (60% height, 1/3 width each) */}
        {/* Column 1: Blue Line Train Tracker */}
        <div style={{ borderRight: '1px solid #27272a', overflow: 'hidden', height: '100%', boxSizing: 'border-box' }} suppressHydrationWarning>
          <iframe
            src="https://www.transitchicago.com/traintracker/popout.aspx?bg=y&sort=time&results=6&fx=y&sid=40590&hideoptions=y&size=small"
            style={iframeStyle}
            title="Blue Line"
            scrolling="no"
            suppressHydrationWarning
          />
        </div>

        {/* Columns 2 & 3: CTA Bus Arrivals */}
        {BUS_STOPS.map((bus, idx) => {
          const base = `https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=${bus.stopId}&bgcolor=${bus.bg}&slidename=${encodeURIComponent(bus.name)}&size=small`;
          const isLast = idx === BUS_STOPS.length - 1;
          return (
            <div
              key={bus.title}
              style={{
                borderRight: isLast ? 'none' : '1px solid #27272a',
                overflow: 'hidden',
                height: '100%',
                boxSizing: 'border-box',
              }}
              suppressHydrationWarning
            >
              <iframe src={nextRefresh ? `${base}&date=${nextRefresh}` : base} style={iframeStyle} title={bus.title} suppressHydrationWarning />
            </div>
          );
        })}
      </div>
    </main>
  );
}
