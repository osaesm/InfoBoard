import Image from 'next/image'
import styles from './page.module.css'
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal, PromiseLikeOfReactNode } from 'react';

dotenv.config();

async function getTransit() {
  try {
    let stopNames: { [id: string]: string; } = {}
    if (!existsSync('localStops.json')) {
      const stopRes = await fetch(
        `http://api.pugetsound.onebusaway.org/api/where/stops-for-location.json?key=${process.env.OBA_KEY}&lat=${process.env.LATITUDE}&lon=${process.env.LONGITUDE}&radius=${150}`
      );
      await new Promise(resolve => setTimeout(resolve, 10000))
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
    await new Promise(resolve => setTimeout(resolve, 10000));
    const arrivals = await arrivalsRes.json().then(d => d['data']['entry']['arrivalsAndDepartures'].filter((arrival: {[id: string]: string}) => stopNames.keys().includes(arrival['stopId'])));
    await writeFile('currentArrivals.json', JSON.stringify(arrivals, null, 2));
    console.log(arrivals);
    return arrivals['entry']['arrivalsAndDepartures'];
  } catch (err) {
    console.error(err);
    return ''
  }
}

export default function Home() {
  return (
    <main>
      <div>
        {
          getTransit().then(stops => stops.map((currStop: [JSON], idx: number) => (
            <p key={idx}>{currStop['stopId']}</p>
          )))}
      </div>
    </main>
  )
}
