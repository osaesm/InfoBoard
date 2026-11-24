import { NextRequest, NextResponse } from 'next/server';

const COMPASS_TO_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

function parseWindDeg(dir: string | undefined): number {
  if (!dir) return 0;
  return COMPASS_TO_DEG[dir.toUpperCase()] ?? 0;
}

function parseWeatherCode(shortForecast: string | undefined, isDay: boolean): number {
  const s = (shortForecast || '').toLowerCase();
  if (s.includes('thunder') || s.includes('tornado')) return 95;
  if (s.includes('blizzard') || s.includes('heavy snow')) return 75;
  if (s.includes('snow') || s.includes('flurr')) return 71;
  if (s.includes('sleet') || s.includes('freezing rain')) return 66;
  if (s.includes('heavy rain') || s.includes('downpour')) return 65;
  if (s.includes('rain') || s.includes('shower')) return 61;
  if (s.includes('drizzle')) return 51;
  if (s.includes('fog') || s.includes('haze') || s.includes('smoke')) return 45;
  if (s.includes('overcast') || (s.includes('cloudy') && !s.includes('partly'))) return 3;
  if (s.includes('partly') || s.includes('mostly')) return 2;
  if (s.includes('clear') || s.includes('sunny')) return 0;
  return 1;
}

function calcFeelsLike(tempF: number, windMph: number, humidity: number): number {
  if (tempF <= 50 && windMph >= 3) {
    return Math.round(
      (35.74 + 0.6215 * tempF - 35.75 * Math.pow(windMph, 0.16) + 0.4275 * tempF * Math.pow(windMph, 0.16)) * 10
    ) / 10;
  } else if (tempF >= 80) {
    return Math.round(
      (tempF + 0.5 * (tempF + 61.0 + (tempF - 68.0) * 1.2 + humidity * 0.094 - tempF)) * 10
    ) / 10;
  }
  return Math.round(tempF * 10) / 10;
}

// In-memory cache for NWS hourly endpoint URL by lat/lon
let nwsEndpointCache: { key: string; url: string; time: number } | null = null;

async function getNwsForecastUrl(lat: string, lon: string): Promise<string | null> {
  const key = `${parseFloat(lat).toFixed(3)},${parseFloat(lon).toFixed(3)}`;
  if (nwsEndpointCache && nwsEndpointCache.key === key && Date.now() - nwsEndpointCache.time < 24 * 3600 * 1000) {
    return nwsEndpointCache.url;
  }

  // Pre-configured for Chicago / Wicker Park coordinates (41.909, -87.677) -> NWS LOT 74,74
  const dLat = Math.abs(parseFloat(lat) - 41.909);
  const dLon = Math.abs(parseFloat(lon) - (-87.677));
  if (dLat < 0.08 && dLon < 0.08) {
    const url = 'https://api.weather.gov/gridpoints/LOT/74,74/forecast/hourly';
    nwsEndpointCache = { key, url, time: Date.now() };
    return url;
  }

  try {
    const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: { 'User-Agent': '(InfoBoard Kiosk, contact@example.com)' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const url = data.properties?.forecastHourly;
    if (url) {
      nwsEndpointCache = { key, url, time: Date.now() };
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const latitude =
      searchParams.get('latitude') ||
      process.env.LATITUDE ||
      process.env.NEXT_PUBLIC_LATITUDE;
    const longitude =
      searchParams.get('longitude') ||
      process.env.LONGITUDE ||
      process.env.NEXT_PUBLIC_LONGITUDE;

    if (!latitude || !longitude) {
      return NextResponse.json(
        {
          error:
            'Latitude and longitude must be provided via query parameters or environment variables',
        },
        { status: 400 }
      );
    }

    // 1. Fetch Open-Meteo (for HRRR 3km sub-hourly precipitation)
    const omParams = new URLSearchParams({
      latitude,
      longitude,
      current:
        'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day',
      hourly:
        'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m',
      minutely_15:
        'precipitation,temperature_2m,apparent_temperature,relative_humidity_2m,weather_code',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto',
      forecast_days: '3',
    });

    const omPromise = fetch(`https://api.open-meteo.com/v1/forecast?${omParams.toString()}`, {
      next: { revalidate: 60 },
    }).then(async (res) => {
      if (!res.ok) return null;
      return res.json();
    }).catch(() => null);

    // 2. Concurrently fetch NWS point forecast (2.5 km grid LOT 74,74)
    const nwsPromise = (async () => {
      try {
        const nwsUrl = await getNwsForecastUrl(latitude, longitude);
        if (!nwsUrl) return null;
        const res = await fetch(nwsUrl, {
          headers: { 'User-Agent': '(InfoBoard Kiosk, contact@example.com)' },
          signal: AbortSignal.timeout(3500),
          next: { revalidate: 120 },
        });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    })();

    const [omData, nwsData] = await Promise.all([omPromise, nwsPromise]);

    if (!omData && !nwsData) {
      return NextResponse.json({ error: 'All weather providers unavailable' }, { status: 502 });
    }

    if (!nwsData || !nwsData.properties?.periods?.length) {
      return NextResponse.json(omData);
    }

    const nwsPeriods = nwsData.properties.periods;
    const currentPeriod = nwsPeriods[0];
    const isDay = currentPeriod.isDaytime ?? false;
    const currentCode = parseWeatherCode(currentPeriod.shortForecast, isDay);
    const currentPrecip = omData?.minutely_15?.precipitation?.[0] ?? omData?.current?.precipitation ?? 0;

    // Build structured NWS hourly points
    const nwsHourlyPoints = nwsPeriods.map((p: any) => {
      const t = p.temperature;
      const w = parseFloat(p.windSpeed) || 0;
      const hum = p.relativeHumidity?.value ?? 50;
      return {
        time: new Date(p.startTime).getTime(),
        timeStr: p.startTime,
        temp: t,
        wind: w,
        windDir: parseWindDeg(p.windDirection),
        hum,
        feels: calcFeelsLike(t, w, hum),
        code: parseWeatherCode(p.shortForecast, p.isDaytime),
      };
    });

    // Helper: interpolate NWS hourly to any target timestamp
    function getInterpolatedNws(targetMs: number) {
      if (nwsHourlyPoints.length === 0) {
        return { temp: 35, feels: 30, hum: 50, wind: 10, windDir: 0, code: currentCode };
      }
      if (targetMs <= nwsHourlyPoints[0].time) {
        return nwsHourlyPoints[0];
      }
      if (targetMs >= nwsHourlyPoints[nwsHourlyPoints.length - 1].time) {
        return nwsHourlyPoints[nwsHourlyPoints.length - 1];
      }

      let idx = 0;
      for (let i = 0; i < nwsHourlyPoints.length - 1; i++) {
        if (nwsHourlyPoints[i].time <= targetMs && targetMs <= nwsHourlyPoints[i + 1].time) {
          idx = i;
          break;
        }
      }
      const p1 = nwsHourlyPoints[idx];
      const p2 = nwsHourlyPoints[idx + 1];
      const span = p2.time - p1.time;
      const alpha = span > 0 ? (targetMs - p1.time) / span : 0;

      const temp = Math.round((p1.temp + (p2.temp - p1.temp) * alpha) * 10) / 10;
      const feels = Math.round((p1.feels + (p2.feels - p1.feels) * alpha) * 10) / 10;
      const hum = Math.round(p1.hum + (p2.hum - p1.hum) * alpha);
      const wind = Math.round((p1.wind + (p2.wind - p1.wind) * alpha) * 10) / 10;
      return {
        temp,
        feels,
        hum,
        wind,
        windDir: alpha < 0.5 ? p1.windDir : p2.windDir,
        code: alpha < 0.5 ? p1.code : p2.code,
      };
    }

    // Current conditions interpolated to NOW
    const nowMs = Date.now();
    const nowInterp = getInterpolatedNws(nowMs);

    // 3. Construct NWS Hourly arrays
    const hourlyTimes: string[] = [];
    const hourlyTemps: number[] = [];
    const hourlyFeels: number[] = [];
    const hourlyHum: number[] = [];
    const hourlyPrecip: number[] = [];
    const hourlyCodes: number[] = [];
    const hourlyWindSpeed: number[] = [];
    const hourlyWindDirection: number[] = [];

    const omHourlyTimes: string[] = omData?.hourly?.time ?? [];
    const omHourlyPrecips: number[] = omData?.hourly?.precipitation ?? [];

    for (const p of nwsHourlyPoints) {
      hourlyTimes.push(p.timeStr);
      hourlyTemps.push(p.temp);
      hourlyHum.push(p.hum);
      hourlyFeels.push(p.feels);
      hourlyWindSpeed.push(p.wind);
      hourlyWindDirection.push(p.windDir);
      hourlyCodes.push(p.code);

      // Match Open-Meteo quantitative precip if time matches
      let matchedPrecip = 0;
      if (omHourlyTimes.length > 0) {
        let bestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < omHourlyTimes.length; i++) {
          const diff = Math.abs(new Date(omHourlyTimes[i]).getTime() - p.time);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
          } else if (diff > minDiff) break;
        }
        if (minDiff < 45 * 60000) {
          matchedPrecip = omHourlyPrecips[bestIdx] ?? 0;
        }
      }
      hourlyPrecip.push(matchedPrecip);
    }

    // 4. Generate 15-Minute Data directly from NWS Hourly curve + HRRR 15-Min Precipitation
    const omMinTimes: string[] = omData?.minutely_15?.time ?? [];
    const omMinPrecips: number[] = omData?.minutely_15?.precipitation ?? [];

    const minTimes: string[] = [];
    const minTemps: number[] = [];
    const minFeels: number[] = [];
    const minHum: number[] = [];
    const minPrecip: number[] = [];
    const minCodes: number[] = [];

    // Anchor minutely intervals around now
    const start15 = Math.floor(nowMs / 900000) * 900000 - 3600000;
    for (let i = 0; i < 96; i++) {
      const t = start15 + i * 900000;
      const tIso = new Date(t).toISOString();
      minTimes.push(tIso);

      const interp = getInterpolatedNws(t);
      minTemps.push(interp.temp);
      minFeels.push(interp.feels);
      minHum.push(interp.hum);
      minCodes.push(interp.code);

      // Find closest HRRR precipitation point
      let precipVal = 0;
      if (omMinTimes.length > 0) {
        let bestIdx = 0;
        let minDiff = Infinity;
        for (let j = 0; j < omMinTimes.length; j++) {
          const diff = Math.abs(new Date(omMinTimes[j]).getTime() - t);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = j;
          } else if (diff > minDiff) break;
        }
        if (minDiff < 10 * 60000) {
          precipVal = omMinPrecips[bestIdx] ?? 0;
        }
      }
      minPrecip.push(precipVal);
    }

    const synthesizedData = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      generationtime_ms: 1.0,
      utc_offset_seconds: -21600,
      timezone: 'America/Chicago',
      timezone_abbreviation: 'CST',
      elevation: 187.0,
      provider: 'NWS (LOT 74,74) + NOAA HRRR (3km)',
      current: {
        time: new Date().toISOString(),
        interval: 900,
        temperature_2m: nowInterp.temp,
        relative_humidity_2m: nowInterp.hum,
        apparent_temperature: nowInterp.feels,
        precipitation: currentPrecip,
        weather_code: nowInterp.code,
        wind_speed_10m: nowInterp.wind,
        wind_direction_10m: nowInterp.windDir,
        is_day: isDay ? 1 : 0,
      },
      hourly: {
        time: hourlyTimes,
        temperature_2m: hourlyTemps,
        apparent_temperature: hourlyFeels,
        relative_humidity_2m: hourlyHum,
        precipitation: hourlyPrecip,
        weather_code: hourlyCodes,
        wind_speed_10m: hourlyWindSpeed,
        wind_direction_10m: hourlyWindDirection,
      },
      minutely_15: {
        time: minTimes,
        temperature_2m: minTemps,
        apparent_temperature: minFeels,
        relative_humidity_2m: minHum,
        precipitation: minPrecip,
        weather_code: minCodes,
      },
    };

    return NextResponse.json(synthesizedData);
  } catch (error: any) {
    console.error('Failed to fetch weather forecast:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch weather forecast',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
