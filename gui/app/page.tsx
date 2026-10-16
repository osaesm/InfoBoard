'use client'

import { useEffect, useState, useCallback } from 'react';
import WeatherCharts, { HourlyDataPoint, MinutelyDataPoint } from './WeatherCharts';

interface WeatherState {
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    precipitation: number;
    weatherCode: number;
    windSpeed: number;
    windDirection: number;
    isDay: boolean;
  };
  hourly: HourlyDataPoint[];
  minutely: MinutelyDataPoint[];
}

function formatHour(isoTime: string, index: number): string {
  if (index === 0) return 'Now';
  const d = new Date(isoTime);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function formatMinutely(isoTime: string, index: number): string {
  if (index === 0) return 'Now';
  const mins = index * 15;
  return `+${mins}m`;
}

export default function Home() {
  const refreshInterval = 60 * 1000;

  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherBusy, setWeatherBusy] = useState<boolean>(true);

  // Initialize as null to prevent Date.now() SSR / hydration mismatch
  const [currTime, setCurrTime] = useState<number | null>(null);
  const [nextRefresh, setNextRefresh] = useState<number | null>(null);

  const getWeather = useCallback(async () => {
    try {
      const lat = process.env.NEXT_PUBLIC_LATITUDE;
      const lon = process.env.NEXT_PUBLIC_LONGITUDE;
      const host = process.env.NEXT_PUBLIC_HOST_URL;

      if (!lat || !lon || !host) {
        throw new Error('Missing NEXT_PUBLIC_LATITUDE, NEXT_PUBLIC_LONGITUDE, or NEXT_PUBLIC_HOST_URL environment variables');
      }

      const url = `${host}/weather/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;

      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Weather fetch failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();

      const now = new Date();

      // Parse hourly data — find starting index for current hour and slice up to 24 hours
      const hourlyTimes: string[] = data.hourly?.time ?? [];
      const currentHourDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      let startIdx = hourlyTimes.findIndex((t: string) => new Date(t) >= currentHourDate);
      if (startIdx === -1) {
        startIdx = 0;
      }
      const sliceEnd = Math.min(startIdx + 24, hourlyTimes.length);

      const hourlyData: HourlyDataPoint[] = [];
      for (let i = startIdx; i < sliceEnd; i++) {
        const itemIdx = i - startIdx;
        hourlyData.push({
          time: formatHour(hourlyTimes[i], itemIdx),
          timeRaw: hourlyTimes[i],
          temperature: data.hourly.temperature_2m[i],
          feelsLike: data.hourly.apparent_temperature[i],
          humidity: data.hourly.relative_humidity_2m[i],
          precipitation: data.hourly.precipitation[i],
          precipitationProbability: data.hourly.precipitation_probability?.[i] ?? 0,
          weatherCode: data.hourly.weather_code[i],
          windSpeed: data.hourly.wind_speed_10m[i],
          windDirection: data.hourly.wind_direction_10m[i],
        });
      }

      // Parse minutely_15 data — 15-minute intervals for next 2 hours (8 intervals)
      const minutelyTimes: string[] = data.minutely_15?.time ?? [];
      const current15MinDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        Math.floor(now.getMinutes() / 15) * 15
      );
      let m15StartIdx = minutelyTimes.findIndex((t: string) => new Date(t) >= current15MinDate);
      if (m15StartIdx === -1) {
        m15StartIdx = 0;
      }
      const minutelyData: MinutelyDataPoint[] = [];
      for (let i = m15StartIdx; i < m15StartIdx + 8 && i < minutelyTimes.length; i++) {
        const itemIdx = i - m15StartIdx;
        minutelyData.push({
          time: formatMinutely(minutelyTimes[i], itemIdx),
          timeRaw: minutelyTimes[i],
          temperature: data.minutely_15.temperature_2m?.[i] ?? data.current.temperature_2m,
          feelsLike: data.minutely_15.apparent_temperature?.[i] ?? data.current.apparent_temperature,
          humidity: data.minutely_15.relative_humidity_2m?.[i] ?? data.current.relative_humidity_2m,
          precipitation: data.minutely_15.precipitation[i],
          weatherCode: data.minutely_15.weather_code?.[i] ?? data.current.weather_code,
        });
      }

      setWeather({
        current: {
          temperature: data.current.temperature_2m,
          feelsLike: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          precipitation: data.current.precipitation,
          weatherCode: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          windDirection: data.current.wind_direction_10m,
          isDay: data.current.is_day === 1,
        },
        hourly: hourlyData,
        minutely: minutelyData,
      });
      setWeatherBusy(false);
    } catch (err) {
      console.error('Error fetching weather:', err);
      setWeatherBusy(false);
    }
  }, []);

  useEffect(() => {
    // Set dynamic timestamps client-side only to avoid SSR hydration mismatch
    const now = Date.now();
    setCurrTime(now);
    setNextRefresh(now + refreshInterval);

    getWeather();

    const intervalId = setInterval(() => {
      const current = Date.now();
      setCurrTime(current);
      setNextRefresh((prev) => {
        if (prev && current > prev) {
          getWeather();
          return current + refreshInterval;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [getWeather, refreshInterval]);

  const minutesSeconds = (x: number) => {
    const clamped = Math.max(0, x);
    return clamped < 60
      ? `${clamped}s`
      : `${Math.floor(clamped / 60)}m ${String(clamped % 60).padStart(2, '0')}s`;
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    width: '100dvw',
    height: '100dvh',
    margin: 0,
    padding: 0,
    backgroundColor: '#121212',
    overflow: 'hidden',
  };

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

  const busNorthwestSrc = nextRefresh
    ? `https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=8929,945,15847&bgcolor=335f4c&slidename=North+%26+West+(Away+from+city)&size=small&date=${nextRefresh}`
    : `https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=8929,945,15847&bgcolor=335f4c&slidename=North+%26+West+(Away+from+city)&size=small`;

  const busSoutheastSrc = nextRefresh
    ? `https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=8849,898,5481&bgcolor=5f333b&slidename=South+%26+East+(City+center)&size=small&date=${nextRefresh}`
    : `https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=8849,898,5481&bgcolor=5f333b&slidename=South+%26+East+(City+center)&size=small`;

  return (
    <main>
      <div style={gridStyle}>
        {/* Top-Left: Weather Quadrant */}
        <div style={{ ...cornerStyle, display: 'flex', flexDirection: 'column' }} suppressHydrationWarning>
          <div
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              color: '#a1a1aa',
              backgroundColor: '#18181b',
              borderBottom: '1px solid #27272a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
            suppressHydrationWarning
          >
            <span suppressHydrationWarning>
              InfoBoard Weather &bull; Auto-refresh in {currTime && nextRefresh ? minutesSeconds(Math.trunc((nextRefresh - currTime) / 1000)) : '60s'}
            </span>
            <span style={{ fontWeight: 600, color: '#e4e4e7' }} suppressHydrationWarning>
              {currTime
                ? new Date(currTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })
                : '--:--:--'}
            </span>
          </div>

          {weatherBusy && !weather ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                fontSize: '16px',
                color: '#a1a1aa',
              }}
            >
              Loading weather forecast...
            </div>
          ) : weather ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <WeatherCharts
                hourlyData={weather.hourly}
                minutelyData={weather.minutely}
                currentTemp={weather.current.temperature}
                currentFeelsLike={weather.current.feelsLike}
                currentHumidity={weather.current.humidity}
                currentPrecip={weather.current.precipitation}
                currentWeatherCode={weather.current.weatherCode}
                currentWindSpeed={weather.current.windSpeed}
                currentWindDirection={weather.current.windDirection}
                isDay={weather.current.isDay}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                fontSize: '14px',
                color: '#f87171',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              Weather data unavailable. Checking connection...
            </div>
          )}
        </div>

        {/* Top-Right: Blue Line CTA */}
        <div style={cornerStyle} suppressHydrationWarning>
          <iframe
            src="https://www.transitchicago.com/traintracker/popout.aspx?bg=y&sort=time&results=6&fx=y&sid=40590&hideoptions=y&size=small"
            style={iframeStyle}
            title="Blue Line"
            scrolling="no"
            suppressHydrationWarning
          />
        </div>

        {/* Bottom-Left: CTA Arrivals (North & West) */}
        <div style={cornerStyle} suppressHydrationWarning>
          <iframe
            src={busNorthwestSrc}
            style={iframeStyle}
            title="Northwest"
            suppressHydrationWarning
          />
        </div>

        {/* Bottom-Right: CTA Arrivals (South & East) */}
        <div style={cornerStyle} suppressHydrationWarning>
          <iframe
            src={busSoutheastSrc}
            style={iframeStyle}
            title="Southeast"
            suppressHydrationWarning
          />
        </div>
      </div>
    </main>
  );
}
