'use client'

import styles from './page.module.css';
import { useEffect, useState } from 'react';
import Image from 'next/image';

interface formattedWeatherJSON {
  number: number,
  startTime: string,
  endTime: string,
  temperature: number,
  temperatureUnit: string,
  precipitationProbability: number,
  humidity: number,
  windSpeed: string,
  windDirection: string,
  icon: string,
  shortForecast: string
}

async function sleep(ms: number) {
  return await new Promise(resolve => setTimeout(resolve, ms));
}

export default function Home() {
  const refreshInterval = 2 * 60;

  const [weatherData, setWeatherData] = useState<formattedWeatherJSON[]>();
  const [weatherBusy, setWeatherBusy] = useState<boolean>(true);

  const [nextRefresh, setNextRefresh] = useState<number>(1);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNextRefresh((t) => t - 1);
      if (nextRefresh <= 0) {
        setNextRefresh(refreshInterval);
        setWeatherBusy(true);
        setWeatherData([]);
        getWeather(5);
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [nextRefresh]);

  const getWeather = async (maxHoursAhead: number) => {
    try {
      const data = await fetch(
        `${process.env.NEXT_PUBLIC_HOST_URL}/weather/points/${process.env.NEXT_PUBLIC_LATITUDE},${process.env.NEXT_PUBLIC_LONGITUDE}`,
        {
          cache: 'no-cache',
        }
      ).then(async res => await res.json()).then(d => d['properties']);
      const weatherBaseUrl = 'https://api.weather.gov'
      // console.log(data['forecastHourly']);

      await sleep(1000);
      const forecastData = await fetch(
        `${process.env.NEXT_PUBLIC_HOST_URL}/weather${data['forecastHourly'].substring(weatherBaseUrl.length)}`,
        {
          cache: 'no-cache',
        }
      ).then(async forecastRes => forecastRes.json());

      const formattedForecast: formattedWeatherJSON[] = [];
      const justHour = (x: string) => {
        return new Date(x).toLocaleTimeString('en-US', {
          hour: 'numeric',
          hour12: true,
        })
      };

      const processIconUrl = (url: string, p: number) => {
        //  if (p > 0) {
        //    return `${url.split('?')[0]}?size=`
        //  }
        return `${url.split(',')[0]}?size=`;
      }

      let currHourIdx = 0;
      for (const fc of forecastData['properties']['periods']) {
        if (new Date(fc.endTime).valueOf() < Date.now()) {
          currHourIdx = fc.number
          console.log(fc.endTime)
          continue
        }
        if (fc.number > (maxHoursAhead + currHourIdx)) continue;
        formattedForecast.push({
          number: fc.number,
          startTime: justHour(fc.startTime),
          endTime: justHour(fc.endTime),
          temperature: fc.temperature,
          temperatureUnit: fc.temperatureUnit,
          precipitationProbability: fc.probabilityOfPrecipitation.value,
          humidity: fc.relativeHumidity.value,
          windSpeed: fc.windSpeed,
          windDirection: fc.windDirection,
          icon: processIconUrl(fc.icon, fc.probabilityOfPrecipitation.value),
          shortForecast: fc.shortForecast
        })
      }
      setWeatherData(formattedForecast);
      setWeatherBusy(false);
    } catch (err) {
      console.error(err);
    }
  }

  const minutesSeconds = (x: number) => { return x < 60 ? `${x.toString()} s` : `${Math.floor(x / 60).toString().padStart(2, '0')} m, ${(x % 60).toString().padStart(2, '0')} s` }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: 0,
  }

  const cornerStyle: React.CSSProperties = {
    border: '1px solid #333',
    overflow: 'hidden', // keeps iframe from spilling out
    position: 'relative',
  }

  const iframeStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    border: 'none',
  }

  return (
    <main >
      <div style={gridStyle}>
        <div suppressHydrationWarning>
          <div>Last Refreshed: {minutesSeconds(refreshInterval - nextRefresh)}</div>
          <div>Refreshing in: {minutesSeconds(nextRefresh)}</div>
          {(weatherBusy || !weatherData) ? <div>Loading weather...</div> : <div className={styles.weatherInfo}>
            <div className={styles.currentWeather}>
              <Image
                alt={weatherData[0].shortForecast}
                width={250}
                height={250}
                src={`${weatherData[0].icon}250`}
                priority />
              <p>{weatherData[0].temperature}&#176; {weatherData[0].temperatureUnit}</p>
              <p>Chance of {weatherData[0].temperature <= 32 ? 'snow' : 'rain'} is {weatherData[0].precipitationProbability}%</p>
              <p>{weatherData[0].startTime}</p>
            </div>
            <div className={styles.futureWeather}>
              {[1, 2, 3, 4].map(x => {
                return <div key={x} className={styles.futureWeatherCard}>
                  <Image
                    alt={weatherData[x].shortForecast}
                    width={125}
                    height={125}
                    src={`${weatherData[x].icon}125`}
                    priority />
                  <p>{weatherData[x].temperature}&#176; {weatherData[x].temperatureUnit}</p>
                  <p>Chance of {weatherData[x].temperature <= 32 ? 'snow' : 'rain'} is {weatherData[x].precipitationProbability}%</p>
                  <p>{weatherData[x].startTime}</p>
                </div>
              })}
            </div>
          </div>}
        </div>
        <div style={cornerStyle}>
          <iframe
            src="https://www.transitchicago.com/traintracker/popout.aspx?bg=y&sort=time&results=6&fx=y&sid=40590&hideoptions=y&size=small"
            style={iframeStyle}
            title="Blue Line"
            scrolling="no"
          />
        </div>

        {/* Bottom‑Left: Iframe 2 */}
        <div style={cornerStyle}>
          <iframe
            src="https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=8929,945,15847&bgcolor=335f4c&slidename=North+%26+West+(Away+from+city)&size=small"
            style={iframeStyle}
            title="Northwest"
          />
        </div>

        {/* Bottom‑Right: Iframe 3 */}
        <div style={cornerStyle}>
          <iframe
            src="https://www.transitchicago.com/diydisplay/showarrivals.aspx?stopid=8849,898,5481&bgcolor=5f333b&slidename=South+%26+East+(City+center)&size=small"
            style={iframeStyle}
            title="Southeast"
          />
        </div>
      </div>
    </main>
  );

}
