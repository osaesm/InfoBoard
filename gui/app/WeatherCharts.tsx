'use client'

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';

export interface HourlyDataPoint {
  time: string;                     // e.g. "Now", "3 PM"
  timeRaw: string;                  // ISO timestamp
  temperature: number;              // °F
  feelsLike: number;                // °F
  humidity: number;                 // %
  precipitation: number;            // inches
  precipitationProbability: number; // %
  weatherCode: number;
  windSpeed: number;                // mph
  windDirection: number;            // deg
}

export interface MinutelyDataPoint {
  time: string;                     // e.g. "Now", "+15m"
  timeRaw: string;                  // ISO timestamp
  temperature: number;              // °F
  feelsLike: number;                // °F
  humidity: number;                 // %
  precipitation: number;            // inches
  weatherCode: number;
}

interface WeatherChartsProps {
  hourlyData: HourlyDataPoint[];
  minutelyData: MinutelyDataPoint[];
  currentTemp: number;
  currentFeelsLike: number;
  currentHumidity: number;
  currentPrecip: number;
  currentWeatherCode: number;
  currentWindSpeed: number;
  currentWindDirection: number;
  isDay: boolean;
}

interface WeatherCodeInfo {
  description: string;
  icon: string;
}

const weatherCodeMap: Record<number, WeatherCodeInfo> = {
  0: { description: 'Clear Sky', icon: '☀️' },
  1: { description: 'Mainly Clear', icon: '🌤️' },
  2: { description: 'Partly Cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Foggy', icon: '🌫️' },
  48: { description: 'Depositing Rime Fog', icon: '🌫️' },
  51: { description: 'Light Drizzle', icon: '🌦️' },
  53: { description: 'Moderate Drizzle', icon: '🌧️' },
  55: { description: 'Dense Drizzle', icon: '🌧️' },
  56: { description: 'Light Freezing Drizzle', icon: '🌨️' },
  57: { description: 'Dense Freezing Drizzle', icon: '🌨️' },
  61: { description: 'Slight Rain', icon: '🌦️' },
  63: { description: 'Moderate Rain', icon: '🌧️' },
  65: { description: 'Heavy Rain', icon: '🌧️' },
  66: { description: 'Light Freezing Rain', icon: '🌨️' },
  67: { description: 'Heavy Freezing Rain', icon: '🌨️' },
  71: { description: 'Slight Snow', icon: '🌨️' },
  73: { description: 'Moderate Snow', icon: '❄️' },
  75: { description: 'Heavy Snow', icon: '❄️' },
  77: { description: 'Snow Grains', icon: '❄️' },
  80: { description: 'Light Showers', icon: '🌦️' },
  81: { description: 'Moderate Showers', icon: '🌧️' },
  82: { description: 'Violent Showers', icon: '⛈️' },
  85: { description: 'Light Snow Showers', icon: '🌨️' },
  86: { description: 'Heavy Snow Showers', icon: '❄️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with Hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with Heavy Hail', icon: '⛈️' },
};

function getWeatherInfo(code: number, isDay: boolean): WeatherCodeInfo {
  const info = weatherCodeMap[code] ?? { description: 'Unknown', icon: '🌡️' };
  if (!isDay) {
    if (code === 0) return { description: 'Clear Night', icon: '🌙' };
    if (code === 1) return { description: 'Mainly Clear Night', icon: '🌙' };
    if (code === 2) return { description: 'Partly Cloudy Night', icon: '☁️' };
  }
  return info;
}

function getWindCompass(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((deg % 360) / 22.5) % 16;
  return directions[index];
}

const chartMargin = { top: 14, right: 14, left: -14, bottom: 0 };

export default function WeatherCharts({
  hourlyData,
  minutelyData,
  currentTemp,
  currentFeelsLike,
  currentHumidity,
  currentPrecip,
  currentWeatherCode,
  currentWindSpeed,
  currentWindDirection,
  isDay,
}: WeatherChartsProps) {
  const [mounted, setMounted] = useState(false);
  // Auto-cycles hands-free on the kiosk between 6-hour hourly and 15-min granular forecast
  const [isGranular, setIsGranular] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Automatic hands-free rotation for passive kiosk display:
  // Shows 6-Hour forecast for 20s, then Granular 15-Minute forecast for 10s
  useEffect(() => {
    const duration = isGranular ? 10000 : 20000;
    const timer = setTimeout(() => {
      setIsGranular((prev) => !prev);
    }, duration);
    return () => clearTimeout(timer);
  }, [isGranular]);

  const weatherInfo = useMemo(
    () => getWeatherInfo(currentWeatherCode, isDay),
    [currentWeatherCode, isDay]
  );

  // Granular precipitation analysis over the next 60 minutes
  const nextHourRainSummary = useMemo(() => {
    const nextHourPoints = minutelyData.slice(0, 5);
    const sum = nextHourPoints.reduce((acc, pt) => acc + (pt.precipitation ?? 0), 0);
    const firstRainIdx = nextHourPoints.findIndex((pt) => (pt.precipitation ?? 0) > 0);
    if (sum === 0 || firstRainIdx === -1) {
      return { hasRain: false, label: 'Next 60m Dry' };
    }
    const mins = firstRainIdx * 15;
    const timeText = mins === 0 ? 'Raining now' : `Rain in ~${mins}m`;
    return {
      hasRain: true,
      label: `${timeText} (${sum.toFixed(2)}")`,
    };
  }, [minutelyData]);

  // Active chart data: 6 hours for hourly view, or next 5 intervals for 15m view
  const chartData = useMemo(() => {
    if (isGranular) {
      return minutelyData.slice(0, 5);
    }
    return hourlyData.slice(0, 6);
  }, [isGranular, hourlyData, minutelyData]);

  // Compute temperature Y-axis domain with ample headroom for on-screen value labels
  const { tempMin, tempMax } = useMemo(() => {
    if (chartData.length === 0) return { tempMin: 30, tempMax: 80 };
    const temps = chartData.flatMap((d) => [d.temperature, d.feelsLike]);
    const minVal = Math.floor(Math.min(...temps));
    const maxVal = Math.ceil(Math.max(...temps));
    const span = Math.max(maxVal - minVal, 4);
    return {
      tempMin: minVal - Math.max(2, Math.round(span * 0.1)),
      tempMax: maxVal + Math.max(5, Math.round(span * 0.25)), // headroom for label visibility
    };
  }, [chartData]);

  // Compute humidity domain with headroom for data labels
  const { humMin, humMax } = useMemo(() => {
    if (chartData.length === 0) return { humMin: 0, humMax: 100 };
    const hums = chartData.map((d) => d.humidity ?? 0);
    const minH = Math.min(...hums);
    const maxH = Math.max(...hums);
    const span = Math.max(maxH - minH, 8);
    return {
      humMin: Math.max(0, Math.floor(minH - Math.max(4, Math.round(span * 0.15)))),
      humMax: Math.min(115, Math.ceil(maxH + Math.max(8, Math.round(span * 0.3)))),
    };
  }, [chartData]);

  // Compute precipitation maximum to scale bars visibly
  const { maxPrecip, totalPrecipWindow } = useMemo(() => {
    if (chartData.length === 0) return { maxPrecip: 0.1, totalPrecipWindow: 0 };
    const precips = chartData.map((d) => d.precipitation ?? 0);
    const maxVal = Math.max(...precips);
    const sum = precips.reduce((acc, v) => acc + v, 0);
    const upper = Math.max(0.1, Math.ceil(maxVal * 20) / 20 + 0.03);
    return { maxPrecip: upper, totalPrecipWindow: sum };
  }, [chartData]);

  if (!mounted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
        Loading charts...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '2px 8px 4px 8px',
        backgroundColor: '#18181b',
        color: '#f4f4f5',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Current Conditions Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          padding: '4px 6px',
          borderBottom: '1px solid #27272a',
          flexShrink: 0,
          gap: '8px',
        }}
      >
        {/* Left: Temp & Weather icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '32px', lineHeight: 1 }} title={weatherInfo.description}>
            {weatherInfo.icon}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>
                {Math.round(currentTemp)}°F
              </span>
              <span style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500 }}>
                Feels {Math.round(currentFeelsLike)}°
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#d4d4d8', fontWeight: 500 }}>
              {weatherInfo.description}
            </span>
          </div>
        </div>

        {/* Center: Key Badges (High Contrast for Kiosk) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#27272a',
              padding: '3px 8px',
              borderRadius: '5px',
              border: '1px solid #3f3f46',
            }}
          >
            <span style={{ color: '#38bdf8' }}>💧</span>
            <span style={{ fontWeight: 600 }}>{currentHumidity}%</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#27272a',
              padding: '3px 8px',
              borderRadius: '5px',
              border: '1px solid #3f3f46',
            }}
          >
            <span style={{ color: nextHourRainSummary.hasRain ? '#60a5fa' : '#4ade80' }}>
              {nextHourRainSummary.hasRain ? '🌧️' : '☀️'}
            </span>
            <span
              style={{
                fontWeight: 600,
                color: nextHourRainSummary.hasRain ? '#93c5fd' : '#86efac',
              }}
            >
              {nextHourRainSummary.label}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#27272a',
              padding: '3px 8px',
              borderRadius: '5px',
              border: '1px solid #3f3f46',
            }}
          >
            <span style={{ color: '#a1a1aa' }}>💨</span>
            <span style={{ fontWeight: 500 }}>
              {Math.round(currentWindSpeed)} mph {getWindCompass(currentWindDirection)}
            </span>
          </div>
        </div>

        {/* Right: Non-Interactive Forecast Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#27272a',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid #3f3f46',
            gap: '6px',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isGranular ? '#38bdf8' : '#22c55e',
              boxShadow: isGranular ? '0 0 6px #38bdf8' : '0 0 6px #22c55e',
            }}
          />
          <span style={{ fontSize: '11px', color: '#f4f4f5', fontWeight: 600 }}>
            {isGranular ? 'Next 1h (15m Intervals)' : '6-Hour Forecast'}
          </span>
        </div>
      </div>

      {/* Static Charts Container (Pointer events disabled to remove all hover behavior) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          marginTop: '2px',
          pointerEvents: 'none',
        }}
      >
        {/* Chart 1: Temperature & Real Feel (Line Chart with direct on-screen labels) */}
        <div style={{ flex: 1.25, minHeight: 0, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: '2px',
              right: '16px',
              zIndex: 10,
              fontSize: '11px',
              color: '#d4d4d8',
              display: 'flex',
              gap: '12px',
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              padding: '1px 8px',
              borderRadius: '4px',
              border: '1px solid #27272a',
            }}
          >
            <span style={{ color: '#fb923c', fontWeight: 600 }}>● Temp (°F)</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>╌ Real Feel (°F)</span>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={chartMargin}>
              <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#52525b"
                tick={false}
                axisLine={{ stroke: '#3f3f46' }}
                height={2}
              />
              <YAxis
                domain={[tempMin, tempMax]}
                stroke="#71717a"
                tick={{ fontSize: 10, fill: '#a1a1aa' }}
                tickFormatter={(v: number) => `${v}°`}
                width={36}
                axisLine={false}
                tickLine={false}
              />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#fb923c"
                strokeWidth={2.6}
                dot={{ r: 3, fill: '#fb923c' }}
                activeDot={false}
                isAnimationActive={false}
              >
                {/* Direct on-screen temperature labels */}
                <LabelList
                  dataKey="temperature"
                  position="top"
                  offset={8}
                  formatter={(v: number) => `${Math.round(v)}°`}
                  style={{ fontSize: '11px', fill: '#fb923c', fontWeight: 700 }}
                />
              </Line>
              <Line
                type="monotone"
                dataKey="feelsLike"
                stroke="#38bdf8"
                strokeWidth={1.8}
                strokeDasharray="4 3"
                dot={{ r: 2, fill: '#38bdf8' }}
                activeDot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Humidity (Area Chart with direct on-screen labels) */}
        <div style={{ flex: 1.0, minHeight: 0, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: '2px',
              right: '16px',
              zIndex: 10,
              fontSize: '11px',
              color: '#38bdf8',
              fontWeight: 600,
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              padding: '1px 8px',
              borderRadius: '4px',
              border: '1px solid #27272a',
            }}
          >
            💧 Humidity (%)
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={chartMargin}>
              <defs>
                <linearGradient id="humidityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#52525b"
                tick={false}
                axisLine={{ stroke: '#3f3f46' }}
                height={2}
              />
              <YAxis
                domain={[humMin, humMax]}
                stroke="#71717a"
                tick={{ fontSize: 10, fill: '#a1a1aa' }}
                tickFormatter={(v: number) => `${v}%`}
                width={36}
                axisLine={false}
                tickLine={false}
              />
              <Area
                type="monotone"
                dataKey="humidity"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#humidityGrad)"
                dot={{ r: 3, fill: '#06b6d4' }}
                activeDot={false}
                isAnimationActive={false}
              >
                {/* Direct on-screen humidity labels for each data point */}
                <LabelList
                  dataKey="humidity"
                  position="top"
                  offset={7}
                  formatter={(v: number) => `${Math.round(v)}%`}
                  style={{ fontSize: '10px', fill: '#22d3ee', fontWeight: 700 }}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Precipitation Totals (Bar Chart with direct on-screen amount labels) */}
        <div style={{ flex: 1.15, minHeight: 0, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: '2px',
              right: '16px',
              zIndex: 10,
              fontSize: '11px',
              color: '#60a5fa',
              fontWeight: 600,
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              padding: '1px 8px',
              borderRadius: '4px',
              border: '1px solid #27272a',
              display: 'flex',
              gap: '6px',
            }}
          >
            <span>🌧️ Precip ({isGranular ? '15m intervals' : 'Hourly total'})</span>
            <span style={{ color: totalPrecipWindow > 0 ? '#93c5fd' : '#a1a1aa', fontWeight: 500 }}>
              Total: {totalPrecipWindow.toFixed(2)}&quot; {totalPrecipWindow === 0 && '(Dry)'}
            </span>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={chartMargin}>
              <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#71717a"
                tick={{ fontSize: 11, fill: '#e4e4e7', fontWeight: 600 }}
                axisLine={{ stroke: '#3f3f46' }}
                interval={0}
                height={22}
              />
              <YAxis
                domain={[0, maxPrecip]}
                stroke="#71717a"
                tick={{ fontSize: 10, fill: '#a1a1aa' }}
                tickFormatter={(v: number) => `${v.toFixed(2)}"`}
                width={36}
                axisLine={false}
                tickLine={false}
              />
              <Bar
                dataKey="precipitation"
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
                minPointSize={2}
              >
                {/* Direct amount labels above bars */}
                <LabelList
                  dataKey="precipitation"
                  position="top"
                  offset={4}
                  formatter={(v: number) => (v > 0.005 ? `${v.toFixed(2)}"` : '')}
                  style={{ fontSize: '10px', fill: '#93c5fd', fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attribution & Kiosk Status Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10px',
          color: '#71717a',
          flexShrink: 0,
          paddingTop: '2px',
        }}
      >
        <span>
          {isGranular
            ? 'Granular 15-minute radar outlook (auto-cycling)'
            : 'Showing next 6 hours (auto-cycling)'}
        </span>
        <span>
          Weather data by{' '}
          <a
            href="https://open-meteo.com/"
            style={{ color: '#a1a1aa', textDecoration: 'none' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open-Meteo
          </a>
        </span>
      </div>
    </div>
  );
}
