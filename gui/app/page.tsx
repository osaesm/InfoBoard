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
  lastUpdateTime: string,
  numberOfStopsAway: number,
  predicted: boolean,
  predictedArrivalTime: string,
  predictedDepartureTime: string,
  routeShortName: string,
  scheduledArrivalTime: string,
  scheduledDepartureTime: string,
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
  const [transitData, setTransitData] = useState<formattedArrivalJSON[]>();
  const [transitBusy, setTransitBusy] = useState<boolean>(true);

  const [weatherData, setWeatherData] = useState<formattedWeatherJSON[]>();
  const [weatherBusy, setWeatherBusy] = useState<boolean>(true);

  useEffect(() => {
    getTransit({
      '1_11060': 'Broadway & E Denny Way',
      '1_11175': 'Broadway And Denny',
      '1_11180': 'Broadway  E & E John St',
      '1_29262': 'E John St & 10th Ave E',
      '1_29270': 'E John St & Broadway  E',
      '40_99603': 'Capitol Hill',
      '40_99610': 'Capitol Hill'
    });
    getWeather();
  }, []);

  const getTransit = async (stopNames: { [id: string]: string }) => {
    try {
      if (Object.keys(stopNames).length === 0) {
        let stopNames: { [id: string]: string } = {};
        const stops: [{ [id: string]: string }] = await fetch(
          `http://osamaserver:2384/transit/api/where/stops-for-location.json?key=${process.env.NEXT_PUBLIC_OBA_KEY}&lat=${process.env.NEXT_PUBLIC_LATITUDE}&lon=${process.env.NEXT_PUBLIC_LONGITUDE}&radius=${150}`,
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
        `http://osamaserver:2384/transit/api/where/arrivals-and-departures-for-location.json?key=${process.env.NEXT_PUBLIC_OBA_KEY}&lat=${process.env.NEXT_PUBLIC_LATITUDE}&lon=${process.env.NEXT_PUBLIC_LONGITUDE}&latSpan=${0.01}&lonSpan=${0.01}`,
        {
          cache: 'no-cache',
        }
      ).then(async arrivalsRes => await arrivalsRes.json()).then(d => {
        return d['data']['entry']['arrivalsAndDepartures'].filter((arrival: arrivalJSON) => Object.keys(stopNames).includes(arrival.stopId) && ((arrival.scheduledDepartureTime - Date.now()) <= 60 * 60 * 1000) && ((Date.now() - arrival.predictedDepartureTime) <= 5 * 60 * 1000))
      });
      const formattedArrivals: formattedArrivalJSON[] = [];
      const hoursMinutes = (x: string) => {
        return new Date(x).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true,
        })
      };
      for (const arrival of arrivals) {
        formattedArrivals.push(
          {
            blockTripSequence: arrival.blockTripSequence,
            lastUpdateTime: hoursMinutes(arrival.lastUpdateTime),
            numberOfStopsAway: arrival.numberOfStopsAway,
            predicted: arrival.predicted,
            predictedArrivalTime: hoursMinutes(arrival.predictedArrivalTime),
            predictedDepartureTime: hoursMinutes(arrival.predictedDepartureTime),
            routeShortName: arrival.routeShortName,
            scheduledArrivalTime: hoursMinutes(arrival.scheduledArrivalTime),
            scheduledDepartureTime: hoursMinutes(arrival.scheduledDepartureTime),
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

  const getWeather = async () => {
    try {
      const data = await fetch(
        `http://osamaserver:2384/weather/points/${process.env.NEXT_PUBLIC_LATITUDE},${process.env.NEXT_PUBLIC_LONGITUDE}`,
        {
          cache: 'no-cache',
        }
      ).then(async res => await res.json()).then(d => d['properties']);
      const weatherBaseUrl = 'https://api.weather.gov'
      // console.log(data['forecastHourly']);

      await sleep(5*1000);
      const forecastData = await fetch(
        `http://osamaserver:2384/weather${data['forecastHourly'].substring(weatherBaseUrl.length)}`,
        {
          cache: 'no-cache',
        }
      ).then(async forecastRes => forecastRes.json());

      const formattedForecast: formattedWeatherJSON[] = [];
      const justHour = (x: string) => {
        return new Date(x).toLocaleTimeString(undefined, {
          hour: 'numeric',
          hour12: true,
        })
      };

      for (const fc of forecastData['properties']['periods']) {
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
          icon: fc.icon,
          shortForecast: fc.shortForecast
        })
      }
      setWeatherData(formattedForecast);
      setWeatherBusy(false);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <main>
      <div suppressHydrationWarning>
        {(transitBusy || !transitData) ? <div>Loading transit...</div> : <table className={styles.transitTable}><tbody>
          {transitData.map((a: formattedArrivalJSON, i: number) => {
            return <tr key={i}>
              <td>{a.routeShortName}</td>
              <td>{a.tripHeadsign}</td>
              <td>{a.predictedDepartureTime}</td>
            </tr>
          })}
        </tbody>
        </table>}
        {(weatherBusy || !weatherData) ? <div>Loading weather...</div> : <table><tbody>
          {weatherData.map((b: formattedWeatherJSON, k: number) => {
            return <tr key={k}>
              <td>{b.startTime}</td>
              <td>Temperature: {b.temperature}&#176; {b.temperatureUnit}</td>
              <td>Chance of rain is {b.precipitationProbability}%</td>
              <td><Image
                alt={b.shortForecast}
                width={50}
                height={50}
                src={b.icon} />
              </td>
            </tr>
          })}
        </tbody>
        </table>}
      </div>
    </main>
  );

}
