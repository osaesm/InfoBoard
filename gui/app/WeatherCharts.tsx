'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  currTime?: number | null;
  countdown?: number;
  lastWeatherUpdate?: number;
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

// Stateless label renderer: takes a full sorted snapshot of label positions computed
// once per data array, then each call just looks up its index.  No shared mutable state
// that could bleed across React renders.
function buildLabelPositions(
  points: { x: number; y: number; value: number }[],
  isBelow: boolean
): { x: number; y: number; value: number }[] {
  const result: { x: number; y: number; value: number }[] = [];
  let prevX = -999;
  let prevY = -999;

  for (const { x, y, value } of points) {
    let finalY: number;

    if (!isBelow) {
      const primaryY = y - 9;
      if (Math.abs(x - prevX) >= 34) {
        finalY = primaryY;
      } else if (Math.abs(primaryY - prevY) >= 14) {
        finalY = primaryY;
      } else {
        const aboveY = prevY - 14;
        const belowY = prevY + 14;
        finalY = belowY <= y - 6 ? belowY : aboveY;
      }
      finalY = Math.max(12, finalY);
    } else {
      const primaryY = y + 15;
      if (Math.abs(x - prevX) >= 34) {
        finalY = primaryY;
      } else if (Math.abs(primaryY - prevY) >= 14) {
        finalY = primaryY;
      } else {
        finalY = Math.max(prevY + 14, y + 26);
      }
    }

    prevX = x;
    prevY = finalY;
    result.push({ x, y: finalY, value });
  }

  return result;
}

// Recharts passes each label's props individually; we need a stable ordered list
// built from the full dataset first.  We use a ref-like accumulator pattern:
// on index===0 we reset and collect, on the last index we emit all at once.
function makeCollisionAwareLabelList(
  fill: string,
  suffix: string,
  isBelow: boolean
) {
  // Accumulator lives OUTSIDE the returned component so a single pass collects all points.
  // It is replaced atomically when index===0 to avoid stale state across data changes.
  let pending: { x: number; y: number; value: number }[] = [];
  let resolved: { x: number; y: number; value: number }[] = [];

  return function LabelContent(props: any) {
    const { x, y, value, index } = props;
    if (value === undefined || value === null) return null;

    if (index === 0) {
      pending = [];
      resolved = [];
    }

    pending[index] = { x, y, value };

    // We won't know the full set until Recharts calls the last label.
    // Recharts calls content in order 0…n-1; on the first pass resolve positions
    // only when we have at least `index+1` entries (i.e. every call after index 0
    // just appends).  We always return the already-resolved position for this index.
    resolved = buildLabelPositions(pending, isBelow);
    const pos = resolved[index];
    if (!pos) return null;

    return (
      <text
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        fill={fill}
        fontSize={13}
        fontWeight={800}
        stroke="#18181b"
        strokeWidth={3.5}
        paintOrder="stroke fill"
        strokeLinejoin="round"
      >
        {`${Math.round(pos.value)}${suffix}`}
      </text>
    );
  };
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
  currTime,
  countdown,
  lastWeatherUpdate,
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

  const { allTicks, tickMap, domainMax } = useMemo(() => {
    const tickSet = new Set<number>();
    const tMap: Record<number, string> = {};

    timeline.forEach((pt) => {
      tickSet.add(pt.timeOffset);
      tMap[pt.timeOffset] = pt.timeLabel;
    });

    const ticks = Array.from(tickSet).sort((a, b) => a - b);
    const maxVal = Math.max(...ticks, 360);

    // If the first non-zero tick is within 10 minutes of Now, suppress the "Now"
    // label to prevent overlap — the data point still exists for the chart line.
    const firstNonZero = ticks.find((t) => t > 0);
    if (firstNonZero !== undefined && firstNonZero < 10) {
      delete tMap[0];
    }

    return {
      allTicks: ticks,
      tickMap: tMap,
      domainMax: maxVal + 12,
    };
  }, [timeline]);

  const renderCustomTick = useCallback((props: any) => {
    const { x, y, payload } = props;
    const label = tickMap[payload.value];
    if (!label) return null;
    const isHourOrNow = label === 'Now' || label.endsWith('AM') || label.endsWith('PM');

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={16}
          textAnchor="middle"
          fill={isHourOrNow ? '#f4f4f5' : '#38bdf8'}
          fontSize={13}
          fontWeight={800}
        >
          {label}
        </text>
      </g>
    );
  }, [tickMap]);

  // Stable label renderers: recreated only when timeline changes (not on every 1s clock tick).
  // Each uses makeCollisionAwareLabelList which accumulates positions from index 0 to N
  // in a single ordered pass — no shared mutable state that bleeds across render cycles.
  const renderTempLabel = useMemo(
    () => makeCollisionAwareLabelList('#fb923c', '°', false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline]
  );
  const renderFeelsLikeLabel = useMemo(
    () => makeCollisionAwareLabelList('#38bdf8', '°', true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline]
  );
  const renderHumidityLabel = useMemo(
    () => makeCollisionAwareLabelList('#22d3ee', '%', false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline]
  );

  // Precip label is stateless (bar x/y/width are authoritative; no collision resolution needed)
  // but wrap in useCallback so the reference is stable across the per-second clock re-renders.
  const renderPrecipLabel = useMemo(() => {
    return function PrecipLabel({ x, y, width, value }: any) {
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
  }, []);

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
      <ChartGrid
        key={lastWeatherUpdate ?? 0}
        timeline={timeline}
        allTicks={allTicks}
        domainMax={domainMax}
        tempDomain={tempDomain}
        humDomain={humDomain}
        maxPrecip={maxPrecip}
        totalPrecip={totalPrecip}
        hasRainExpected={hasRainExpected}
        renderTempLabel={renderTempLabel}
        renderFeelsLikeLabel={renderFeelsLikeLabel}
        renderHumidityLabel={renderHumidityLabel}
        renderPrecipLabel={renderPrecipLabel}
        renderCustomTick={renderCustomTick}
      />
    </div>
  );
}

interface ChartGridProps {
  timeline: WeatherPoint[];
  allTicks: number[];
  domainMax: number;
  tempDomain: [number, number];
  humDomain: [number, number];
  maxPrecip: number;
  totalPrecip: number;
  hasRainExpected: boolean;
  renderTempLabel: any;
  renderFeelsLikeLabel: any;
  renderHumidityLabel: any;
  renderPrecipLabel: any;
  renderCustomTick: any;
}

const ChartGrid = React.memo(function ChartGrid({
  timeline,
  allTicks,
  domainMax,
  tempDomain,
  humDomain,
  maxPrecip,
  totalPrecip,
  hasRainExpected,
  renderTempLabel,
  renderFeelsLikeLabel,
  renderHumidityLabel,
  renderPrecipLabel,
  renderCustomTick,
}: ChartGridProps) {
  return (
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
  );
});
