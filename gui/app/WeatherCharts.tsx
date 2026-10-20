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
  isClockHour?: boolean;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
}

interface WeatherChartsProps {
  timeline: WeatherPoint[];
  extraTicks?: WeatherPoint[];
  currentTemp: number;
  currentFeelsLike: number;
  currentHumidity: number;
  currentPrecip: number;
  currentWeatherCode: number;
  currentWindSpeed: number;
  currentWindDirection: number;
  isDay: boolean;
  currTime?: number | null;
  countdown?: number;
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

const chartMargin = { top: 28, right: 18, left: 6, bottom: 2 };
const commonYAxis = {
  stroke: '#71717a',
  tick: { fontSize: 13, fill: '#d4d4d8', fontWeight: 600 },
  width: 52,
  axisLine: false,
  tickLine: false,
};
const commonGrid = <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />;

function ChartCard({
  title,
  children,
  borderRight = true,
}: {
  title: React.ReactNode;
  children: React.ReactElement;
  borderRight?: boolean;
}) {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        position: 'relative',
        borderRight: borderRight ? '1px solid #27272a' : 'none',
        paddingRight: 2,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 14,
          zIndex: 10,
          fontSize: 14,
          color: '#d4d4d8',
          backgroundColor: 'rgba(24, 24, 27, 0.9)',
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid #3f3f46',
          display: 'flex',
          gap: 12,
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

function createCollisionResolver(isBelow: boolean = false) {
  let prevX = -999;
  let prevY = -999;

  return function resolveLabelPos(props: any) {
    const { x, y, value, index } = props;
    if (value === undefined || value === null) return null;

    if (index === 0) {
      prevX = -999;
      prevY = -999;
    }

    let finalY: number;

    if (!isBelow) {
      // Primary candidate is 9px above the point
      const primaryY = y - 9;
      // If horizontal distance to previous label is large, no collision risk
      if (Math.abs(x - prevX) >= 34) {
        finalY = primaryY;
      } else {
        // Points are horizontally close (< 34px)
        // Check if primaryY collides with prevY (within 14px)
        if (Math.abs(primaryY - prevY) >= 14) {
          finalY = primaryY;
        } else {
          // Collision! Determine whether to push above or below the forbidden zone [prevY - 14, prevY + 14]
          const aboveY = prevY - 14;
          const belowY = prevY + 14;
          // belowY is only valid if it stays above the point dot (at least 6px above y)
          if (belowY <= y - 6) {
            finalY = belowY;
          } else {
            finalY = aboveY;
          }
        }
      }
      finalY = Math.max(12, finalY);
    } else {
      // Below the point (for Feels Like)
      const primaryY = y + 15;
      if (Math.abs(x - prevX) >= 34) {
        finalY = primaryY;
      } else {
        if (Math.abs(primaryY - prevY) >= 14) {
          finalY = primaryY;
        } else {
          // Shift further below the forbidden zone
          finalY = Math.max(prevY + 14, y + 26);
        }
      }
    }

    prevX = x;
    prevY = finalY;

    return { x, y: finalY, value };
  };
}

export default function WeatherCharts({
  timeline,
  extraTicks,
  currentTemp,
  currentFeelsLike,
  currentHumidity,
  currentPrecip,
  currentWeatherCode,
  currentWindSpeed,
  currentWindDirection,
  isDay,
  currTime,
  countdown,
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

  const { allTicks, tickMap, clockMap, domainMax } = useMemo(() => {
    const ticks: number[] = [];
    const tMap: Record<number, string> = {};
    const cMap: Record<number, boolean> = {};

    timeline.forEach((pt) => {
      ticks.push(pt.timeOffset);
      tMap[pt.timeOffset] = pt.timeLabel;
      cMap[pt.timeOffset] = !!pt.isClockHour;
    });

    if (extraTicks) {
      extraTicks.forEach((pt) => {
        if (!ticks.includes(pt.timeOffset)) {
          ticks.push(pt.timeOffset);
          tMap[pt.timeOffset] = pt.timeLabel;
          cMap[pt.timeOffset] = true;
        }
      });
    }

    ticks.sort((a, b) => a - b);
    const maxVal = Math.max(...ticks, 360);

    return {
      allTicks: ticks,
      tickMap: tMap,
      clockMap: cMap,
      domainMax: maxVal + 12,
    };
  }, [timeline, extraTicks]);

  const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const label = tickMap[payload.value];
    if (!label) return null;
    const isClock = clockMap[payload.value];

    return (
      <g transform={`translate(${x},${y})`}>
        {isClock ? (
          <text
            x={0}
            y={20}
            textAnchor="middle"
            fill="#f4f4f5"
            fontSize={14}
            fontWeight={800}
          >
            {label}
          </text>
        ) : (
          <text
            x={0}
            y={6}
            textAnchor="middle"
            fill="#38bdf8"
            fontSize={13}
            fontWeight={700}
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  const renderTempLabel = useMemo(() => {
    const resolver = createCollisionResolver(false);
    return function TempLabel(props: any) {
      const pos = resolver(props);
      if (!pos) return null;
      return (
        <text
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          fill="#fb923c"
          fontSize={13}
          fontWeight={800}
          stroke="#18181b"
          strokeWidth={3.5}
          paintOrder="stroke fill"
          strokeLinejoin="round"
        >
          {`${Math.round(pos.value)}°`}
        </text>
      );
    };
  }, [timeline]);

  const renderFeelsLikeLabel = useMemo(() => {
    const resolver = createCollisionResolver(true);
    return function FeelsLikeLabel(props: any) {
      const pos = resolver(props);
      if (!pos) return null;
      return (
        <text
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          fill="#38bdf8"
          fontSize={13}
          fontWeight={800}
          stroke="#18181b"
          strokeWidth={3.5}
          paintOrder="stroke fill"
          strokeLinejoin="round"
        >
          {`${Math.round(pos.value)}°`}
        </text>
      );
    };
  }, [timeline]);

  const renderHumidityLabel = useMemo(() => {
    const resolver = createCollisionResolver(false);
    return function HumidityLabel(props: any) {
      const pos = resolver(props);
      if (!pos) return null;
      return (
        <text
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          fill="#22d3ee"
          fontSize={13}
          fontWeight={800}
          stroke="#18181b"
          strokeWidth={3.5}
          paintOrder="stroke fill"
          strokeLinejoin="round"
        >
          {`${Math.round(pos.value)}%`}
        </text>
      );
    };
  }, [timeline]);

  const renderPrecipLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (!value || value <= 0.005) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fill="#93c5fd"
        fontSize={12}
        fontWeight={800}
        stroke="#18181b"
        strokeWidth={3.5}
        paintOrder="stroke fill"
        strokeLinejoin="round"
      >
        {`${value.toFixed(2)}"`}
      </text>
    );
  };

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

  const hasRainExpected = totalPrecip > 0.005 || (currentPrecip ?? 0) > 0.005;

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
        padding: '0 4px 4px 4px',
        backgroundColor: '#18181b',
        color: '#f4f4f5',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Current Conditions & Unified Header Bar - Doubled font sizes for distance legibility */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          padding: '10px 18px',
          borderBottom: '1px solid #27272a',
          backgroundColor: '#18181b',
          flexShrink: 0,
          gap: 16,
        }}
      >
        {/* Left: Weather Icon, Temperature, Real Feel, Condition */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 68, lineHeight: 1 }} title={weather.desc}>{weather.icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 58, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1 }}>{Math.round(currentTemp)}°F</span>
              <span style={{ fontSize: 26, color: '#38bdf8', fontWeight: 700, lineHeight: 1 }}>Feels {Math.round(currentFeelsLike)}°</span>
            </div>
            <span style={{ fontSize: 22, color: '#d4d4d8', fontWeight: 600, marginTop: 4 }}>{weather.desc}</span>
          </div>
        </div>

        {/* Center: Humidity, Rain Summary, Wind badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#27272a', padding: '8px 16px', borderRadius: 8, border: '1px solid #3f3f46' }}>
            <span style={{ color: '#38bdf8', fontSize: 26 }}>💧</span>
            <span style={{ fontWeight: 700, fontSize: 24 }}>{currentHumidity}%</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#27272a', padding: '8px 16px', borderRadius: 8, border: '1px solid #3f3f46' }}>
            <span style={{ color: nextHourRain.hasRain ? '#60a5fa' : '#4ade80', fontSize: 26 }}>{nextHourRain.hasRain ? '🌧️' : '☀️'}</span>
            <span style={{ fontWeight: 700, fontSize: 24, color: nextHourRain.hasRain ? '#93c5fd' : '#86efac' }}>{nextHourRain.label}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#27272a', padding: '8px 16px', borderRadius: 8, border: '1px solid #3f3f46' }}>
            <span style={{ color: '#a1a1aa', fontSize: 26 }}>💨</span>
            <span style={{ fontWeight: 700, fontSize: 24 }}>{Math.round(currentWindSpeed)} mph {getWindCompass(currentWindDirection)}</span>
          </div>
        </div>

        {/* Right: Clock & Refresh Countdown */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
          <span style={{ fontSize: 46, fontWeight: 900, color: '#f4f4f5', fontFamily: 'monospace', letterSpacing: '-1px', lineHeight: 1.1 }}>
            {currTime ? new Date(currTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : '--:--:--'}
          </span>
          <span style={{ fontSize: 20, color: '#a1a1aa', fontWeight: 600, marginTop: 4 }}>
            ⟳ Refresh: {countdown !== undefined ? `${countdown}s` : '--'}
          </span>
        </div>
      </div>

      {/* Static Charts Container: Dynamic 2 or 3 charts depending on rain */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: hasRainExpected ? 'repeat(3, 1fr)' : '1fr 1fr',
          gap: 0,
          marginTop: 4,
          pointerEvents: 'none',
        }}
      >
        {/* Chart 1: Temperature & Real Feel */}
        <ChartCard
          borderRight={true}
          title={
            <>
              <span style={{ color: '#fb923c', fontWeight: 700 }}>● Temp (°F)</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>╌ Real Feel (°F)</span>
            </>
          }
        >
          <LineChart data={timeline} margin={{ ...chartMargin, bottom: 2 }}>
            {commonGrid}
            <XAxis
              type="number"
              dataKey="timeOffset"
              domain={[-10, domainMax]}
              ticks={allTicks}
              tick={renderCustomTick}
              axisLine={{ stroke: '#3f3f46' }}
              interval={0}
              height={36}
            />
            <YAxis {...commonYAxis} domain={tempDomain} tickFormatter={(v: number) => `${v}°`} />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#fb923c"
              strokeWidth={3}
              dot={{ r: 3.5, fill: '#fb923c' }}
              activeDot={false}
              isAnimationActive={false}
            >
              <LabelList content={renderTempLabel} />
            </Line>
            <Line
              type="monotone"
              dataKey="feelsLike"
              stroke="#38bdf8"
              strokeWidth={2.2}
              strokeDasharray="4 3"
              dot={{ r: 3, fill: '#38bdf8' }}
              activeDot={false}
              isAnimationActive={false}
            >
              <LabelList content={renderFeelsLikeLabel} />
            </Line>
          </LineChart>
        </ChartCard>

        {/* Chart 2: Humidity */}
        <ChartCard borderRight={hasRainExpected} title={<span style={{ color: '#22d3ee', fontWeight: 700 }}>💧 Humidity (%)</span>}>
          <AreaChart data={timeline} margin={{ ...chartMargin, bottom: 2 }}>
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
              domain={[-10, domainMax]}
              ticks={allTicks}
              tick={renderCustomTick}
              axisLine={{ stroke: '#3f3f46' }}
              interval={0}
              height={36}
            />
            <YAxis {...commonYAxis} domain={humDomain} tickFormatter={(v: number) => `${v}%`} />
            <Area
              type="monotone"
              dataKey="humidity"
              stroke="#06b6d4"
              strokeWidth={2.4}
              fill="url(#humGrad)"
              dot={{ r: 3.5, fill: '#06b6d4' }}
              activeDot={false}
              isAnimationActive={false}
            >
              <LabelList content={renderHumidityLabel} />
            </Area>
          </AreaChart>
        </ChartCard>

        {/* Chart 3: Precipitation Totals (Only rendered when rain is expected) */}
        {hasRainExpected && (
          <ChartCard
            borderRight={false}
            title={
              <>
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>🌧️ Precip (in)</span>
                <span style={{ color: totalPrecip > 0 ? '#93c5fd' : '#a1a1aa', fontWeight: 600 }}>
                  Total: {totalPrecip.toFixed(2)}&quot;
                </span>
              </>
            }
          >
            <BarChart data={timeline} margin={{ ...chartMargin, bottom: 2 }}>
              {commonGrid}
              <XAxis
                type="number"
                dataKey="timeOffset"
                domain={[-10, domainMax]}
                ticks={allTicks}
                tick={renderCustomTick}
                axisLine={{ stroke: '#3f3f46' }}
                interval={0}
                height={36}
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
                <LabelList content={renderPrecipLabel} />
              </Bar>
            </BarChart>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
