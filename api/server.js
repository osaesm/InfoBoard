const express = require('express')
const cors = require('cors')
const path = require('path')

// Load environment variables from api/.env and root .env as fallback
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const app = express()
const port = process.env.PORT_NUMBER;

app.use(cors());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/weather/forecast', async (req, res) => {
  try {
    const latitude = req.query.latitude || process.env.LATITUDE;
    const longitude = req.query.longitude || process.env.LONGITUDE;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude must be provided via query parameters or environment variables',
      });
    }

    const params = new URLSearchParams({
      latitude,
      longitude,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day',
      hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m',
      minutely_15: 'precipitation,temperature_2m,apparent_temperature,relative_humidity_2m,weather_code',
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
      return res.status(response.status).json({ error: 'Weather provider error', details: errText });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Failed to fetch weather forecast:', error);
    res.status(500).json({ error: 'Failed to fetch weather forecast', message: error.message });
  }
})

app.listen(port, () => {
  console.log(`Weather API server listening on port ${port}`)
})

