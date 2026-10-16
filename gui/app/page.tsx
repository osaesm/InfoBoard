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
  hourly: WeatherPoint[];
  minutely: WeatherPoint[];
}

const BUS_STOPS = [
  { title: 'Northwest', stopId: '8929,945,15847', bg: '335f4c', name: 'North & West (Away from city)' },
  { title: 'Southeast', stopId: '8849,898,5481', bg: '5f333b', name: 'South & East (City center)' },
];

function mapPoints(times: string[], temp: number[], feels: number[], hum: number[], precip: number[], start: number, count: number, isMinutely = false): WeatherPoint[] {
  return times.slice(start, start + count).map((t, i) => ({
    time: i === 0 ? 'Now' : isMinutely ? `+${i * 15}m` : new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
    temperature: temp?.[start + i] ?? 0,
    feelsLike: feels?.[start + i] ?? 0,
    humidity: hum?.[start + i] ?? 0,
    precipitation: precip?.[start + i] ?? 0,
  }));
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
      const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const current15m = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), Math.floor(now.getMinutes() / 15) * 15);

      const hTimes: string[] = data.hourly?.time ?? [];
      const mTimes: string[] = data.minutely_15?.time ?? [];
      const startH = Math.max(0, hTimes.findIndex((t: string) => new Date(t) >= currentHour));
      const startM = Math.max(0, mTimes.findIndex((t: string) => new Date(t) >= current15m));

      setWeather({
        current: {
          temp: data.current.temperature_2m,
          feelsLike: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          precip: data.current.precipitation,
          code: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          windDirection: data.current.wind_direction_10m,
          isDay: data.current.is_day === 1,
        },
        hourly: mapPoints(hTimes, data.hourly.temperature_2m, data.hourly.apparent_temperature, data.hourly.relative_humidity_2m, data.hourly.precipitation, startH, 6),
        minutely: mapPoints(mTimes, data.minutely_15.temperature_2m, data.minutely_15.apparent_temperature, data.minutely_15.relative_humidity_2m, data.minutely_15.precipitation, startM, 5, true),
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

  const cornerStyle: React.CSSProperties = {
    border: '1px solid #27272a',
    overflow: 'hidden',
    position: 'relative',
    scrollbarWidth: 'none',
    boxSizing: 'border-box',
    width: '50dvw',
    height: '50dvh',
  };

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', width: '100dvw', height: '100dvh', margin: 0, padding: 0, backgroundColor: '#121212', overflow: 'hidden' }}>
        {/* Top-Left: Weather Quadrant */}
        <div style={{ ...cornerStyle, display: 'flex', flexDirection: 'column' }} suppressHydrationWarning>
          <div style={{ fontSize: 11, padding: '3px 8px', color: '#a1a1aa', backgroundColor: '#18181b', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }} suppressHydrationWarning>
            <span>InfoBoard Weather &bull; Auto-refresh in {countdown}s</span>
            <span style={{ fontWeight: 600, color: '#e4e4e7' }}>
              {currTime ? new Date(currTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : '--:--:--'}
            </span>
          </div>

          {weatherBusy && !weather ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: 16, color: '#a1a1aa' }}>Loading weather...</div>
          ) : weather ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <WeatherCharts
                hourlyData={weather.hourly}
                minutelyData={weather.minutely}
                currentTemp={weather.current.temp}
                currentFeelsLike={weather.current.feelsLike}
                currentHumidity={weather.current.humidity}
                currentPrecip={weather.current.precip}
                currentWeatherCode={weather.current.code}
                currentWindSpeed={weather.current.windSpeed}
                currentWindDirection={weather.current.windDirection}
                isDay={weather.current.isDay}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: 14, color: '#f87171', padding: 16, textAlign: 'center' }}>Weather data unavailable. Checking connection...</div>
          )}
        </div>

        {/* Top-Right: Blue Line Train Tracker */}
        <div style={cornerStyle} suppressHydrationWarning>
          <iframe
            src="https://www.transitchicago.com/traintracker/popout.aspx?bg=y&sort=time&results=6&fx=y&sid=40590&hideoptions=y&size=small"
            style={iframeStyle}
            title="Blue Line"
            scrolling="no"
            suppressHydrationWarning
          />
        </div>

        {/* Bottom Quadrants: CTA Bus Arrivals */}
        {BUS_STOPS.map((bus) => {
          const base = `https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=${bus.stopId}&bgcolor=${bus.bg}&slidename=${encodeURIComponent(bus.name)}&size=small`;
          return (
            <div key={bus.title} style={cornerStyle} suppressHydrationWarning>
              <iframe src={nextRefresh ? `${base}&date=${nextRefresh}` : base} style={iframeStyle} title={bus.title} suppressHydrationWarning />
            </div>
          );
        })}
      </div>
    </main>
  );
}
