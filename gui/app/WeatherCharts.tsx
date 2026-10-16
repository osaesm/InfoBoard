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

export interface WeatherPoint {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
}

interface WeatherChartsProps {
  hourlyData: WeatherPoint[];
  minutelyData: WeatherPoint[];
  currentTemp: number;
  currentFeelsLike: number;
  currentHumidity: number;
  currentPrecip: number;
  currentWeatherCode: number;
  currentWindSpeed: number;
  currentWindDirection: number;
  isDay: boolean;
}

function getWeatherInfo(code: number, isDay: boolean): { desc: string; icon: string } {
  if (code === 0) return { desc: isDay ? 'Clear' : 'Clear Night', icon: isDay ? '☀️' : '🌙' };
  if (code <= 2) return { desc: isDay ? 'Partly Cloudy' : 'Partly Cloudy Night', icon: isDay ? '⛅' : '☁️' };
  if (code === 3) return { desc: 'Overcast', icon: '☁️' };
  if (code <= 48) return { desc: 'Foggy', icon: '🌫️' };
  if (code <= 57) return { desc: 'Drizzle', icon: '🌦️' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { desc: 'Rain', icon: '🌧️' };
  if (code <= 77 || (code >= 85 && code <= 86)) return { desc: 'Snow', icon: '❄️' };
  if (code >= 95) return { desc: 'Thunderstorm', icon: '⛈️' };
  return { desc: 'Fair', icon: '🌡️' };
}

function getWindCompass(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round((deg % 360) / 45) % 8];
}

function getDomain(values: number[], padLo = 2, padHi = 5, floor?: number, cap?: number): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 4);
  const lo = min - Math.max(padLo, Math.round(span * 0.1));
  const hi = max + Math.max(padHi, Math.round(span * 0.25));
  return [floor !== undefined ? Math.max(floor, lo) : lo, cap !== undefined ? Math.min(cap, hi) : hi];
}

const chartMargin = { top: 14, right: 14, left: -14, bottom: 0 };
const commonYAxis = { stroke: '#71717a', tick: { fontSize: 10, fill: '#a1a1aa' }, width: 36, axisLine: false, tickLine: false };
const commonGrid = <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />;

function ChartCard({ title, children, flex = 1 }: { title: React.ReactNode; children: React.ReactElement; flex?: number }) {
  return (
    <div style={{ flex, minHeight: 0, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 2,
          right: 16,
          zIndex: 10,
          fontSize: 11,
          color: '#d4d4d8',
          backgroundColor: 'rgba(24, 24, 27, 0.85)',
          padding: '1px 8px',
          borderRadius: 4,
          border: '1px solid #27272a',
          display: 'flex',
          gap: 12,
        }}
      >
        {title}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

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
  const [isGranular, setIsGranular] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Automatic hands-free rotation between 6h hourly (20s) and 15m granular (10s)
  useEffect(() => {
    const timer = setTimeout(() => setIsGranular((prev) => !prev), isGranular ? 10000 : 20000);
    return () => clearTimeout(timer);
  }, [isGranular]);

  const weather = useMemo(() => getWeatherInfo(currentWeatherCode, isDay), [currentWeatherCode, isDay]);

  const nextHourRain = useMemo(() => {
    const pts = minutelyData.slice(0, 5);
    const sum = pts.reduce((acc, pt) => acc + (pt.precipitation ?? 0), 0);
    const firstIdx = pts.findIndex((pt) => (pt.precipitation ?? 0) > 0);
    if (sum === 0 || firstIdx === -1) return { hasRain: false, label: 'Next 60m Dry' };
    const mins = firstIdx * 15;
    return { hasRain: true, label: `${mins === 0 ? 'Raining now' : `Rain in ~${mins}m`} (${sum.toFixed(2)}")` };
  }, [minutelyData]);

  const chartData = useMemo(() => (isGranular ? minutelyData.slice(0, 5) : hourlyData.slice(0, 6)), [isGranular, hourlyData, minutelyData]);

  const tempDomain = useMemo(() => getDomain(chartData.flatMap((d) => [d.temperature, d.feelsLike]), 2, 5), [chartData]);
  const humDomain = useMemo(() => getDomain(chartData.map((d) => d.humidity), 4, 8, 0, 115), [chartData]);
  const { maxPrecip, totalPrecip } = useMemo(() => {
    const precips = chartData.map((d) => d.precipitation ?? 0);
    const maxVal = Math.max(...precips, 0);
    const sum = precips.reduce((a, b) => a + b, 0);
    return { maxPrecip: Math.max(0.1, Math.ceil(maxVal * 20) / 20 + 0.03), totalPrecip: sum };
  }, [chartData]);

  if (!mounted) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>Loading charts...</div>;
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
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 32, lineHeight: 1 }} title={weather.desc}>{weather.icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>{Math.round(currentTemp)}°F</span>
              <span style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 500 }}>Feels {Math.round(currentFeelsLike)}°</span>
            </div>
            <span style={{ fontSize: 12, color: '#d4d4d8', fontWeight: 500 }}>{weather.desc}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#27272a', padding: '3px 8px', borderRadius: 5, border: '1px solid #3f3f46' }}>
            <span style={{ color: '#38bdf8' }}>💧</span>
            <span style={{ fontWeight: 600 }}>{currentHumidity}%</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#27272a', padding: '3px 8px', borderRadius: 5, border: '1px solid #3f3f46' }}>
            <span style={{ color: nextHourRain.hasRain ? '#60a5fa' : '#4ade80' }}>{nextHourRain.hasRain ? '🌧️' : '☀️'}</span>
            <span style={{ fontWeight: 600, color: nextHourRain.hasRain ? '#93c5fd' : '#86efac' }}>{nextHourRain.label}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#27272a', padding: '3px 8px', borderRadius: 5, border: '1px solid #3f3f46' }}>
            <span style={{ color: '#a1a1aa' }}>💨</span>
            <span style={{ fontWeight: 500 }}>{Math.round(currentWindSpeed)} mph {getWindCompass(currentWindDirection)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#27272a', padding: '3px 8px', borderRadius: 6, border: '1px solid #3f3f46', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', backgroundColor: isGranular ? '#38bdf8' : '#22c55e', boxShadow: isGranular ? '0 0 6px #38bdf8' : '0 0 6px #22c55e' }} />
          <span style={{ fontSize: 11, color: '#f4f4f5', fontWeight: 600 }}>{isGranular ? 'Next 1h (15m Intervals)' : '6-Hour Forecast'}</span>
        </div>
      </div>

      {/* Static Charts Container */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2, pointerEvents: 'none' }}>
        {/* Chart 1: Temperature & Real Feel */}
        <ChartCard
          flex={1.25}
          title={
            <>
              <span style={{ color: '#fb923c', fontWeight: 600 }}>● Temp (°F)</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>╌ Real Feel (°F)</span>
            </>
          }
        >
          <LineChart data={chartData} margin={chartMargin}>
            {commonGrid}
            <XAxis dataKey="time" stroke="#52525b" tick={false} axisLine={{ stroke: '#3f3f46' }} height={2} />
            <YAxis {...commonYAxis} domain={tempDomain} tickFormatter={(v: number) => `${v}°`} />
            <Line type="monotone" dataKey="temperature" stroke="#fb923c" strokeWidth={2.6} dot={{ r: 3, fill: '#fb923c' }} activeDot={false} isAnimationActive={false}>
              <LabelList dataKey="temperature" position="top" offset={8} formatter={(v: number) => `${Math.round(v)}°`} style={{ fontSize: 11, fill: '#fb923c', fontWeight: 700 }} />
            </Line>
            <Line type="monotone" dataKey="feelsLike" stroke="#38bdf8" strokeWidth={1.8} strokeDasharray="4 3" dot={{ r: 2, fill: '#38bdf8' }} activeDot={false} isAnimationActive={false} />
          </LineChart>
        </ChartCard>

        {/* Chart 2: Humidity */}
        <ChartCard flex={1} title={<span style={{ color: '#38bdf8', fontWeight: 600 }}>💧 Humidity (%)</span>}>
          <AreaChart data={chartData} margin={chartMargin}>
            <defs>
              <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {commonGrid}
            <XAxis dataKey="time" stroke="#52525b" tick={false} axisLine={{ stroke: '#3f3f46' }} height={2} />
            <YAxis {...commonYAxis} domain={humDomain} tickFormatter={(v: number) => `${v}%`} />
            <Area type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={2} fill="url(#humGrad)" dot={{ r: 3, fill: '#06b6d4' }} activeDot={false} isAnimationActive={false}>
              <LabelList dataKey="humidity" position="top" offset={7} formatter={(v: number) => `${Math.round(v)}%`} style={{ fontSize: 10, fill: '#22d3ee', fontWeight: 700 }} />
            </Area>
          </AreaChart>
        </ChartCard>

        {/* Chart 3: Precipitation Totals */}
        <ChartCard
          flex={1.15}
          title={
            <>
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>🌧️ Precip ({isGranular ? '15m intervals' : 'Hourly total'})</span>
              <span style={{ color: totalPrecip > 0 ? '#93c5fd' : '#a1a1aa', fontWeight: 500 }}>
                Total: {totalPrecip.toFixed(2)}&quot; {totalPrecip === 0 && '(Dry)'}
              </span>
            </>
          }
        >
          <BarChart data={chartData} margin={chartMargin}>
            {commonGrid}
            <XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 11, fill: '#e4e4e7', fontWeight: 600 }} axisLine={{ stroke: '#3f3f46' }} interval={0} height={22} />
            <YAxis {...commonYAxis} domain={[0, maxPrecip]} tickFormatter={(v: number) => `${v.toFixed(2)}"`} />
            <Bar dataKey="precipitation" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} minPointSize={2}>
              <LabelList dataKey="precipitation" position="top" offset={4} formatter={(v: number) => (v > 0.005 ? `${v.toFixed(2)}"` : '')} style={{ fontSize: 10, fill: '#93c5fd', fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      {/* Attribution Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#71717a', flexShrink: 0, paddingTop: 2 }}>
        <span>{isGranular ? 'Granular 15-minute radar outlook (auto-cycling)' : 'Showing next 6 hours (auto-cycling)'}</span>
        <span>
          Weather data by{' '}
          <a href="https://open-meteo.com/" style={{ color: '#a1a1aa', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
            Open-Meteo
          </a>
        </span>
      </div>
    </div>
  );
}
