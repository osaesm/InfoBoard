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
  timeOffset: number;
  timeLabel: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
}

interface WeatherChartsProps {
  timeline: WeatherPoint[];
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

function getDomain(values: number[], padLo = 4, padHi = 6, floor?: number, cap?: number): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 4);
  const lo = min - Math.max(padLo, Math.round(span * 0.12));
  const hi = max + Math.max(padHi, Math.round(span * 0.18));
  return [floor !== undefined ? Math.max(floor, lo) : lo, cap !== undefined ? Math.min(cap, hi) : hi];
}

const chartMargin = { top: 20, right: 18, left: 6, bottom: 2 };
const commonYAxis = {
  stroke: '#71717a',
  tick: { fontSize: 12, fill: '#d4d4d8', fontWeight: 600 },
  width: 52,
  axisLine: false,
  tickLine: false,
};
const commonGrid = <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />;

function ChartCard({ title, children, flex = 1 }: { title: React.ReactNode; children: React.ReactElement; flex?: number }) {
  return (
    <div style={{ flex, minHeight: 0, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 3,
          right: 18,
          zIndex: 10,
          fontSize: 13,
          color: '#d4d4d8',
          backgroundColor: 'rgba(24, 24, 27, 0.9)',
          padding: '2px 10px',
          borderRadius: 4,
          border: '1px solid #3f3f46',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
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
  timeline,
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

  useEffect(() => { setMounted(true); }, []);

  const weather = useMemo(() => getWeatherInfo(currentWeatherCode, isDay), [currentWeatherCode, isDay]);

  const nextHourRain = useMemo(() => {
    const pts = timeline.filter((pt) => pt.timeOffset <= 60);
    const sum = pts.reduce((acc, pt) => acc + (pt.precipitation ?? 0), 0);
    const firstIdx = pts.findIndex((pt) => (pt.precipitation ?? 0) > 0);
    if (sum === 0 || firstIdx === -1) return { hasRain: false, label: 'Next 60m Dry' };
    const mins = pts[firstIdx].timeOffset;
    return {
      hasRain: true,
      label: `${mins === 0 ? 'Raining now' : `Rain in ~${mins}m`} (${sum.toFixed(2)}")`,
    };
  }, [timeline]);

  const timelineTicks = useMemo(() => timeline.map((d) => d.timeOffset), [timeline]);
  const tickMap = useMemo(() => {
    const map: Record<number, string> = {};
    timeline.forEach((pt) => {
      map[pt.timeOffset] = pt.timeLabel;
    });
    return map;
  }, [timeline]);

  const tempDomain = useMemo(
    () => getDomain(timeline.flatMap((d) => [d.temperature, d.feelsLike]), 5, 6),
    [timeline]
  );
  const humDomain = useMemo(
    () => getDomain(timeline.map((d) => d.humidity), 5, 8, 0, 105),
    [timeline]
  );
  const { maxPrecip, totalPrecip } = useMemo(() => {
    const precips = timeline.map((d) => d.precipitation ?? 0);
    const maxVal = Math.max(...precips, 0);
    const sum = precips.reduce((a, b) => a + b, 0);
    return {
      maxPrecip: Math.max(0.1, Math.ceil(maxVal * 20) / 20 + 0.03),
      totalPrecip: sum,
    };
  }, [timeline]);

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
        padding: '2px 8px 6px 8px',
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
          padding: '6px 8px',
          borderBottom: '1px solid #27272a',
          flexShrink: 0,
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 36, lineHeight: 1 }} title={weather.desc}>{weather.icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>{Math.round(currentTemp)}°F</span>
              <span style={{ fontSize: 16, color: '#38bdf8', fontWeight: 700 }}>Feels {Math.round(currentFeelsLike)}°</span>
            </div>
            <span style={{ fontSize: 13, color: '#d4d4d8', fontWeight: 600 }}>{weather.desc}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, backgroundColor: '#27272a', padding: '4px 10px', borderRadius: 6, border: '1px solid #3f3f46' }}>
            <span style={{ color: '#38bdf8' }}>💧</span>
            <span style={{ fontWeight: 700 }}>{currentHumidity}%</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, backgroundColor: '#27272a', padding: '4px 10px', borderRadius: 6, border: '1px solid #3f3f46' }}>
            <span style={{ color: nextHourRain.hasRain ? '#60a5fa' : '#4ade80' }}>{nextHourRain.hasRain ? '🌧️' : '☀️'}</span>
            <span style={{ fontWeight: 700, color: nextHourRain.hasRain ? '#93c5fd' : '#86efac' }}>{nextHourRain.label}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, backgroundColor: '#27272a', padding: '4px 10px', borderRadius: 6, border: '1px solid #3f3f46' }}>
            <span style={{ color: '#a1a1aa' }}>💨</span>
            <span style={{ fontWeight: 700 }}>{Math.round(currentWindSpeed)} mph {getWindCompass(currentWindDirection)}</span>
          </div>
        </div>
      </div>

      {/* Static Charts Container */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, pointerEvents: 'none' }}>
        {/* Chart 1: Temperature & Real Feel */}
        <ChartCard
          flex={1.15}
          title={
            <>
              <span style={{ color: '#fb923c', fontWeight: 700 }}>● Temp (°F)</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>╌ Real Feel (°F)</span>
            </>
          }
        >
          <LineChart data={timeline} margin={chartMargin}>
            {commonGrid}
            <XAxis
              type="number"
              dataKey="timeOffset"
              domain={[-12, 372]}
              ticks={timelineTicks}
              tick={false}
              axisLine={{ stroke: '#3f3f46' }}
              height={2}
            />
            <YAxis {...commonYAxis} domain={tempDomain} tickFormatter={(v: number) => `${v}°`} />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#fb923c"
              strokeWidth={2.8}
              dot={{ r: 3.5, fill: '#fb923c' }}
              activeDot={false}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="temperature"
                position="top"
                offset={8}
                formatter={(v: number) => `${Math.round(v)}°`}
                style={{ fontSize: 13, fill: '#fb923c', fontWeight: 800 }}
              />
            </Line>
            <Line
              type="monotone"
              dataKey="feelsLike"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 3, fill: '#38bdf8' }}
              activeDot={false}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="feelsLike"
                position="bottom"
                offset={8}
                formatter={(v: number) => `${Math.round(v)}°`}
                style={{ fontSize: 13, fill: '#38bdf8', fontWeight: 800 }}
              />
            </Line>
          </LineChart>
        </ChartCard>

        {/* Chart 2: Humidity */}
        <ChartCard flex={1} title={<span style={{ color: '#22d3ee', fontWeight: 700 }}>💧 Humidity (%)</span>}>
          <AreaChart data={timeline} margin={chartMargin}>
            <defs>
              <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {commonGrid}
            <XAxis
              type="number"
              dataKey="timeOffset"
              domain={[-12, 372]}
              ticks={timelineTicks}
              tick={false}
              axisLine={{ stroke: '#3f3f46' }}
              height={2}
            />
            <YAxis {...commonYAxis} domain={humDomain} tickFormatter={(v: number) => `${v}%`} />
            <Area
              type="monotone"
              dataKey="humidity"
              stroke="#06b6d4"
              strokeWidth={2.2}
              fill="url(#humGrad)"
              dot={{ r: 3.5, fill: '#06b6d4' }}
              activeDot={false}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="humidity"
                position="top"
                offset={7}
                formatter={(v: number) => `${Math.round(v)}%`}
                style={{ fontSize: 13, fill: '#22d3ee', fontWeight: 800 }}
              />
            </Area>
          </AreaChart>
        </ChartCard>

        {/* Chart 3: Precipitation Totals */}
        <ChartCard
          flex={1.15}
          title={
            <>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>🌧️ Precip (in)</span>
              <span style={{ color: totalPrecip > 0 ? '#93c5fd' : '#a1a1aa', fontWeight: 600 }}>
                Total: {totalPrecip.toFixed(2)}&quot; {totalPrecip === 0 && '(Dry)'}
              </span>
            </>
          }
        >
          <BarChart data={timeline} margin={{ ...chartMargin, bottom: 0 }}>
            {commonGrid}
            <XAxis
              type="number"
              dataKey="timeOffset"
              domain={[-12, 372]}
              ticks={timelineTicks}
              tick={{ fontSize: 13, fill: '#f4f4f5', fontWeight: 700 }}
              tickFormatter={(v: number) => tickMap[v] ?? ''}
              axisLine={{ stroke: '#3f3f46' }}
              interval={0}
              height={26}
            />
            <YAxis
              {...commonYAxis}
              domain={[0, maxPrecip]}
              tickFormatter={(v: number) => `${v.toFixed(2)}"`}
            />
            <Bar
              dataKey="precipitation"
              fill="#3b82f6"
              radius={[3, 3, 0, 0]}
              barSize={14}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="precipitation"
                position="top"
                offset={5}
                formatter={(v: number) => (v > 0.005 ? `${v.toFixed(2)}"` : '')}
                style={{ fontSize: 12, fill: '#93c5fd', fontWeight: 800 }}
              />
            </Bar>
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
