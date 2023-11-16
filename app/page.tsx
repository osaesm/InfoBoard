import Image from 'next/image'
import styles from './page.module.css'
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal, PromiseLikeOfReactNode } from 'react';

dotenv.config();

async function sleep(ms: number) {
  return await new Promise(resolve => setTimeout(resolve, ms));
}

async function getTransit() {
  try {
    let stopNames: { [id: string]: string; } = {}
    if (!existsSync('localStops.json')) {
      const stopRes = await fetch(
        `http://api.pugetsound.onebusaway.org/api/where/stops-for-location.json?key=${process.env.OBA_KEY}&lat=${process.env.LATITUDE}&lon=${process.env.LONGITUDE}&radius=${150}`
      );
      await sleep(10*1000);
      const stops = await stopRes.json().then(d => d['data']['list']);
      for (const currStop of stops) {
        stopNames[currStop['id']] = currStop['name'];
      }
      await writeFile('localStops.json', JSON.stringify(stopNames)).catch(err => {
        console.log(err);
      });
    } else {
      stopNames = await readFile('localStops.json', 'utf-8').then((x) => JSON.parse(x));
    }
    console.log(stopNames)
    const arrivalsRes = await fetch(
      `http://api.pugetsound.onebusaway.org/api/where/arrivals-and-departures-for-location.json?key=${process.env.OBA_KEY}&lat=${process.env.LATITUDE}&lon=${process.env.LONGITUDE}&latSpan=${0.0075}&lonSpan=${0.0075}`
    )
    await sleep(10*1000);
    const arrivals = await arrivalsRes.json().then(d => d['data']['entry']['arrivalsAndDepartures'].filter((arrival: {[id: string]: string}) => Object.keys(stopNames).includes(arrival['stopId'])));
    await writeFile('currentArrivals.json', JSON.stringify(arrivals, null, 2));
    return arrivals;
  } catch (err) {
    console.error(err);
    return {}
  }
}

async function getWeather() {
  try {
    const res = await fetch(
      `https://api.weather.gov/points/${process.env.LATITUDE},${process.env.LONGITUDE}`
    );
    await sleep(1000);
    const data = await res.json().then(d => d['properties']);
    await writeFile('weatherData.json', JSON.stringify(data, null, 2));
    const forecastData = await fetch(data['forecast']);
    console.log(await forecastData.json());
  } catch (err) {
    console.error(err);
  }
  return '';
}

export default function Home() {
  return (
    <main>
      <div>
        {/* {
          getTransit().then(stops => stops.map((currStop: {[idx: string]: string}, idx: number) => (
            <p key={idx}>{currStop['stopId']}</p>
          )))} */}
          {
            <div>Test {getWeather()}</div>
          }
      </div>
    </main>
  )
}
