'use client'

import styles from './page.module.css';
import { useEffect, useState } from 'react';
import Image from 'next/image';

interface arrivalJSON {
  predictedDepartureTime: number,
  scheduledDepartureTime: number,
  stopId: string,
}

interface formattedArrivalJSON {
  blockTripSequence: number,
  lastUpdateTime: number,
  numberOfStopsAway: number,
  predicted: boolean,
  predictedArrivalTime: number,
  predictedDepartureTime: number,
  routeShortName: string,
  scheduledArrivalTime: number,
  scheduledDepartureTime: number,
  stopId: string,
  stopSequence: number,
  tripHeadsign: string,
  tripStatus: JSON,
}

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

  const [transitData, setTransitData] = useState<formattedArrivalJSON[]>();
  const [transitBusy, setTransitBusy] = useState<boolean>(true);

  const [weatherData, setWeatherData] = useState<formattedWeatherJSON[]>();
  const [weatherBusy, setWeatherBusy] = useState<boolean>(true);

  const [nextRefresh, setNextRefresh] = useState<number>(1);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNextRefresh((t) => t - 1);
      if (nextRefresh <= 0) {
        setNextRefresh(refreshInterval);
        setTransitBusy(true);
        setTransitData([]);
        getTransit({
          '1_11060': 'Broadway & E Denny Way',
          '1_11175': 'Broadway And Denny',
          '1_11180': 'Broadway  E & E John St',
          '1_29262': 'E John St & 10th Ave E',
          '1_29270': 'E John St & Broadway  E',
          '40_99603': 'Capitol Hill',
          '40_99610': 'Capitol Hill'
        });
        setWeatherBusy(true);
        setWeatherData([]);
        getWeather(5);
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [nextRefresh]);

  const getTransit = async (stopNames: { [id: string]: string }) => {
    try {
      if (Object.keys(stopNames).length === 0) {
        let stopNames: { [id: string]: string } = {};
        const stops: [{ [id: string]: string }] = await fetch(
          `${process.env.NEXT_PUBLIC_HOST_URL}/transit/api/where/stops-for-location.json?key=${process.env.NEXT_PUBLIC_OBA_KEY}&lat=${process.env.NEXT_PUBLIC_LATITUDE}&lon=${process.env.NEXT_PUBLIC_LONGITUDE}&radius=${150}`,
          {
            cache: 'no-cache',
          }
        ).then(async stopRes => await stopRes.json()).then(d => d['data']['list']);
        await sleep(10 * 1000);
        for (const currStop of stops) {
          stopNames[currStop['id']] = currStop['name'];
        }
        console.log(stopNames);
      }
      const arrivals = await fetch(
        `${process.env.NEXT_PUBLIC_HOST_URL}/transit/api/where/arrivals-and-departures-for-location.json?key=${process.env.NEXT_PUBLIC_OBA_KEY}&lat=${process.env.NEXT_PUBLIC_LATITUDE}&lon=${process.env.NEXT_PUBLIC_LONGITUDE}&latSpan=${0.01}&lonSpan=${0.01}`,
        {
          cache: 'no-cache',
        }
      ).then(async arrivalsRes => await arrivalsRes.json()).then(d => {
        return d['data']['entry']['arrivalsAndDepartures'].filter((arrival: arrivalJSON) => Object.keys(stopNames).includes(arrival.stopId) && ((arrival.scheduledDepartureTime - Date.now()) <= 60 * 60 * 1000) && ((Date.now() - arrival.predictedDepartureTime) <= 2 * 60 * 1000))
      });
      const formattedArrivals: formattedArrivalJSON[] = [];
      for (const arrival of arrivals) {
        formattedArrivals.push(
          {
            blockTripSequence: arrival.blockTripSequence,
            lastUpdateTime: Math.round(arrival.lastUpdateTime / 1000),
            numberOfStopsAway: arrival.numberOfStopsAway,
            predicted: arrival.predicted,
            predictedArrivalTime: Math.round(arrival.predictedArrivalTime / 1000),
            predictedDepartureTime: Math.round(arrival.predictedDepartureTime / 1000),
            routeShortName: arrival.routeShortName,
            scheduledArrivalTime: Math.round(arrival.scheduledArrivalTime / 1000),
            scheduledDepartureTime: Math.round(arrival.scheduledDepartureTime / 1000),
            stopId: arrival.stopId,
            stopSequence: arrival.stopSequence,
            tripHeadsign: arrival.tripHeadsign,
            tripStatus: arrival.tripStatus,
          }
        )
      }
      const sortedArrivals = formattedArrivals.sort((a: formattedArrivalJSON, b: formattedArrivalJSON) => {
        if (a.predictedDepartureTime <= b.predictedDepartureTime) {
          return -1;
        }
        return 1;
      });
      setTransitData(sortedArrivals);
      setTransitBusy(false);
    } catch (err) {
      console.error(err);
    }
  }

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
        if (p > 0) {
          return `${url.split('?')[0]}?size=`
        }
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

  return (
    <main>
      <div>Last Refreshed: {minutesSeconds(refreshInterval - nextRefresh)}</div>
      <div>Refreshing in: {minutesSeconds(nextRefresh)}</div>
      <div suppressHydrationWarning>
        {(transitBusy || !transitData) ? <div>Loading transit...</div> : <table className={styles.transitTable}><tbody>
          {transitData.filter((b: formattedArrivalJSON) => b.predictedDepartureTime - Math.round(Date.now() / 1000) > 0).map((a: formattedArrivalJSON, i: number) => {
            return <tr key={i}>
              <td>{a.routeShortName}</td>
              <td>{a.tripHeadsign}</td>
              <td>{minutesSeconds(a.predictedDepartureTime - Math.round(Date.now() / 1000))}</td>
            </tr>
          })}
        </tbody>
        </table>}
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
    </main>
  );

}
