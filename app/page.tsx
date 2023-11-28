'use client'

// import dotenv from 'dotenv';
// import { writeFile } from 'fs/promises';
import styles from './page.module.css';
import { useEffect, useState } from 'react';
// import { useEffect, useState } from 'react';

// dotenv.config();

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

async function sleep(ms: number) {
  return await new Promise(resolve => setTimeout(resolve, ms));
}

async function getWeather() {
  try {
    const res = await fetch(
      `https://api.weather.gov/points/${process.env.NEXT_PUBLIC_LATITUDE},${process.env.NEXT_PUBLIC_LONGITUDE}`,
      {
        cache: 'no-cache',
      }
    );
    // await sleep(1000);
    const data = await res.json().then(d => d['properties']);
    console.log(data['forecastHourly']);
    const forecastRes = await fetch(
      data['forecastHourly'],
      {
        cache: 'no-cache',
      }
    );
    const forecastData = await forecastRes.json();
    // await writeFile('forecastData.json', JSON.stringify(forecastData, null, 2));
    const formattedForecast = [];
    const justHour = (x: string) => {
      new Date(x).toLocaleTimeString(undefined, {
        hour: 'numeric',
        hour12: true,
      })
    };
    for (const fc of forecastData['properties']['periods']) {
      formattedForecast.push({
        'number': fc.number,
        'startTime': justHour(fc.startTime),
        'endTime': justHour(fc.endTime),
        'temperature': fc.temperature,
        'temperatureUnit': fc.temperatureUnit,
        'precipitationProbability': fc.probabilityOfPrecipitation.value,
        'humidity': fc.relativeHumidity.value,
        'windSpeed': fc.windSpeed,
        'windDirection': fc.windDirection,
        'icon': fc.icon,
        'shortForecast': fc.shortForecast
      })
    }
    // await writeFile('formattedWeather.json', JSON.stringify(formattedForecast, null, 2));
  } catch (err) {
    console.error(err);
  }
  return '';
}

export default function Home() {

  const [transitData, setTransitData] = useState<formattedArrivalJSON[]>();
  const [isBusy, setIsBusy] = useState<boolean>(true);
  useEffect(() => {
    getTransit();
  }, []);

  const getTransit = async () => {
    try {
      let stopNames: { [id: string]: string; } = {}
      const stops = await fetch(
        `http://api.pugetsound.onebusaway.org/api/where/stops-for-location.json?key=${process.env.NEXT_PUBLIC_OBA_KEY}&lat=${process.env.NEXT_PUBLIC_LATITUDE}&lon=${process.env.NEXT_PUBLIC_LONGITUDE}&radius=${150}`,
        {
          cache: 'no-cache',
        }
      ).then(async stopRes => await stopRes.json()).then(d => d['data']['list']);
      for (const currStop of stops) {
        stopNames[currStop['id']] = currStop['name'];
      }
      // console.log(stopNames)
      const arrivalsRes = await fetch(
        `http://api.pugetsound.onebusaway.org/api/where/arrivals-and-departures-for-location.json?key=${process.env.NEXT_PUBLIC_OBA_KEY}&lat=${process.env.NEXT_PUBLIC_LATITUDE}&lon=${process.env.NEXT_PUBLIC_LONGITUDE}&latSpan=${0.01}&lonSpan=${0.01}`,
        {
          cache: 'no-cache',
        }
      )
      // await sleep(10 * 1000);
      const arrivals = await arrivalsRes.json().then(d => d['data']['entry']['arrivalsAndDepartures'].filter((arrival: arrivalJSON) => {
        return Object.keys(stopNames).includes(arrival.stopId) && ((arrival.scheduledDepartureTime - Date.now()) < 60 * 60 * 1000) && ((Date.now() - arrival.predictedDepartureTime) <= 5*60*1000)
      }));
      // await writeFile('currentArrivals.json', JSON.stringify(arrivals, null, 2));
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
            'blockTripSequence': arrival.blockTripSequence,
            'lastUpdateTime': hoursMinutes(arrival.lastUpdateTime),
            'numberOfStopsAway': arrival.numberOfStopsAway,
            'predicted': arrival.predicted,
            'predictedArrivalTime': hoursMinutes(arrival.predictedArrivalTime),
            'predictedDepartureTime': hoursMinutes(arrival.predictedDepartureTime),
            'routeShortName': arrival.routeShortName,
            'scheduledArrivalTime': hoursMinutes(arrival.scheduledArrivalTime),
            'scheduledDepartureTime': hoursMinutes(arrival.scheduledDepartureTime),
            'stopId': arrival.stopId,
            'stopSequence': arrival.stopSequence,
            'tripHeadsign': arrival.tripHeadsign,
            'tripStatus': arrival.tripStatus,
          }
        )
      }
      const sortedArrivals = formattedArrivals.sort((a: formattedArrivalJSON, b: formattedArrivalJSON) => {
        if (a.predictedDepartureTime <= b.predictedDepartureTime) {
          return -1;
        }
        return 1;
      });
      // await writeFile('formattedArrivals.json', JSON.stringify(sortedArrivals, null, 2));
      setTransitData(sortedArrivals);
      setIsBusy(false);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <main>
      <div suppressHydrationWarning>
        {(isBusy || !transitData) ? <div>Loading...</div> : <table className={styles.transitTable}><tbody>
          {transitData.map((a: formattedArrivalJSON, i: number) => {
            return <tr key={i}>
              <td>{a.routeShortName}</td>
              <td>{a.tripHeadsign}</td>
              <td>{a.predictedDepartureTime}</td>
            </tr>
          })}
        </tbody>
        </table>
        }
      </div>
    </main>
  );
}
