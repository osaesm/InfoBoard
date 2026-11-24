import { NextRequest, NextResponse } from 'next/server';

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

    const params = new URLSearchParams({
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

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Open-Meteo returned status ${response.status}: ${errText}`);
      return NextResponse.json(
        { error: 'Weather provider error', details: errText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
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
