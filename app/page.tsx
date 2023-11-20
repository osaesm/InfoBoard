import Image from 'next/image'
import styles from './page.module.css'
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal, PromiseLikeOfReactNode } from 'react';

dotenv.config();

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

async function getTransit() {
  try {
    let stopNames: { [id: string]: string; } = {}
    if (!existsSync('localStops.json')) {
      const stopRes = await fetch(
        `http://api.pugetsound.onebusaway.org/api/where/stops-for-location.json?key=${process.env.OBA_KEY}&lat=${process.env.LATITUDE}&lon=${process.env.LONGITUDE}&radius=${150}`,
        { cache: 'no-cache' }
      );
      await sleep(10 * 1000);
      const stops = await stopRes.json().then(d => d['data']['list']);
      for (const currStop of stops) {
        stopNames[currStop['id']] = currStop['name'];
      }
      await writeFile('localStops.json', JSON.stringify(stopNames, null, 2)).catch(err => {
        console.log(err);
      });
    } else {
      stopNames = await readFile('localStops.json', 'utf-8').then((x) => JSON.parse(x));
    }
    // console.log(stopNames)
    const arrivalsRes = await fetch(
      `http://api.pugetsound.onebusaway.org/api/where/arrivals-and-departures-for-location.json?key=${process.env.OBA_KEY}&lat=${process.env.LATITUDE}&lon=${process.env.LONGITUDE}&latSpan=${0.01}&lonSpan=${0.01}`,
      { cache: 'no-cache' }
    )
    await sleep(10 * 1000);
    const arrivals = await arrivalsRes.json().then(d => d['data']['entry']['arrivalsAndDepartures'].filter((arrival: arrivalJSON) => {
      return Object.keys(stopNames).includes(arrival.stopId) && ((arrival.scheduledDepartureTime - Date.now()) < 60*60*1000)
    }));
    await writeFile('currentArrivals.json', JSON.stringify(arrivals, null, 2));
    const formattedArrivals = [];
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
    const sortedArrivals = formattedArrivals.sort((a: { [id: string]: any }, b: { [id: string]: any }) => {
      if (a.predictedDepartureTime <= b.predictedDepartureTime) {
        return -1;
      }
      return 1;
    });
    await writeFile('formattedArrivals.json', JSON.stringify(sortedArrivals, null, 2));
    return sortedArrivals;
  } catch (err) {
    console.error(err);
  }
  return [];
}

async function getWeather() {
  try {
    const res = await fetch(
      `https://api.weather.gov/points/${process.env.LATITUDE},${process.env.LONGITUDE}`,
      { cache: 'no-cache' }
    );
    await sleep(1000);
    const data = await res.json().then(d => d['properties']);
    console.log(data['forecastHourly']);
    const forecastRes = await fetch(
      data['forecastHourly'],
      { cache: 'no-cache' }
    );
    const forecastData = await forecastRes.json();
    await writeFile('forecastData.json', JSON.stringify(forecastData, null, 2));
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
    await writeFile('formattedWeather.json', JSON.stringify(formattedForecast, null, 2));
  } catch (err) {
    console.error(err);
  }
  return '';
}

export default function Home() {
  return (
    <main>
      <div>
        {/* <div>Test Transit {getTransit()}</div> */}
        {/* <div>Test Weather {getWeather()}</div> */}
        {getTransit().then(transitData => transitData.map((a: formattedArrivalJSON, i: number) => {
          return <div key={i}>The {a.routeShortName} to {a.tripHeadsign} is leaving at {a.predictedDepartureTime}</div>
        }))}
      </div>
    </main>
  )
}
