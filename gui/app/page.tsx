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
  extraTicks?: WeatherPoint[];
}

const BUS_STOPS = [
  { title: 'Northwest', stopId: '8929,945,15847', bg: '335f4c', name: 'North & West (Away from city)' },
  { title: 'Southeast', stopId: '8849,898,5481', bg: '5f333b', name: 'South & East (City center)' },
];

function buildTimeline(
  current: { temp: number; feelsLike: number; humidity: number; precip: number },
  data: any,
  now: Date
): { timeline: WeatherPoint[]; extraTicks: WeatherPoint[] } {
  const points: WeatherPoint[] = [];
  const extraTicks: WeatherPoint[] = [];
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

  // Point 0: Current conditions (Now)
  points.push({
    timeOffset: 0,
    timeLabel: 'Now',
    isClockHour: true,
    temperature: current.temp,
    feelsLike: current.feelsLike,
    humidity: current.humidity,
    precipitation: current.precip ?? 0,
  });

  const nowMs = now.getTime();
  const cadence = [15, 30, 45, 60];

  // The next clock hour H1 (e.g., 3 PM)
  const h1Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
  const h1Offset = Math.round((h1Date.getTime() - nowMs) / 60000);
  const h1Label = h1Date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

  // Check if H1 coincides with any cadence mark (within 3 mins)
  const coincidesIdx = cadence.findIndex((c) => Math.abs(c - h1Offset) <= 3);

  for (let i = 0; i < cadence.length; i++) {
    const c = cadence[i];
    const itemOffset = i === coincidesIdx ? h1Offset : c;
    const itemLabel = i === coincidesIdx ? h1Label : (c === 60 ? '+1h' : `${c}m`);
    const isClock = i === coincidesIdx;
    const itemDate = i === coincidesIdx ? h1Date : new Date(nowMs + c * 60000);
    const idxM = findClosestIndex(itemDate.getTime(), mTimes);

    points.push({
      timeOffset: itemOffset,
      timeLabel: itemLabel,
      isClockHour: isClock,
      temperature: data.minutely_15?.temperature_2m?.[idxM] ?? current.temp,
      feelsLike: data.minutely_15?.apparent_temperature?.[idxM] ?? current.feelsLike,
      humidity: data.minutely_15?.relative_humidity_2m?.[idxM] ?? current.humidity,
      precipitation: data.minutely_15?.precipitation?.[idxM] ?? 0,
    });
  }

  // If H1 does not coincide with any 15-minute cadence mark, include it as an X-axis tick ONLY (no data point plotted)
  if (coincidesIdx === -1 && h1Offset > 3 && h1Offset < 60) {
    extraTicks.push({
      timeOffset: h1Offset,
      timeLabel: h1Label,
      isClockHour: true,
      temperature: current.temp,
      feelsLike: current.feelsLike,
      humidity: current.humidity,
      precipitation: 0,
    });
  }

  // Subsequent clock hours (+2h to +6h from current hour)
  for (let h = 2; h <= 6; h++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + h, 0, 0);
    const offset = Math.round((d.getTime() - nowMs) / 60000);
    const label = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    const idxH = findClosestIndex(d.getTime(), hTimes);

    points.push({
      timeOffset: offset,
      timeLabel: label,
      isClockHour: true,
      temperature: data.hourly?.temperature_2m?.[idxH] ?? current.temp,
      feelsLike: data.hourly?.apparent_temperature?.[idxH] ?? current.feelsLike,
      humidity: data.hourly?.relative_humidity_2m?.[idxH] ?? current.humidity,
      precipitation: data.hourly?.precipitation?.[idxH] ?? 0,
    });
  }

  return { timeline: points, extraTicks };
}

export default function Home() {
  const refreshInterval = 60 * 1000;

  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(true);
  const [currTime, setCurrTime] = useState<number | null>(null);
  const [nextRefresh, setNextRefresh] = useState<number | null>(null);

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

      const { timeline, extraTicks } = buildTimeline(current, data, now);

      setWeather({
        current,
        timeline,
        extraTicks,
      });
      setWeatherBusy(false);
    } catch (err) {
      console.error('Weather error:', err);
      setWeatherBusy(false);
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    setCurrTime(now);
    setNextRefresh(now + refreshInterval);
    getWeather();

    const intervalId = setInterval(() => {
      const current = Date.now();
      setCurrTime(current);
      setNextRefresh((prev) => (prev && current > prev ? (getWeather(), current + refreshInterval) : prev));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [getWeather, refreshInterval]);

  const iframeStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    border: 'none',
    scrollbarWidth: 'none',
  };

  const countdown = currTime && nextRefresh ? Math.max(0, Math.trunc((nextRefresh - currTime) / 1000)) : 60;

  return (
    <main>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: '40dvh 60dvh',
          gridTemplateColumns: 'repeat(3, 1fr)',
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
                extraTicks={weather.extraTicks}
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
