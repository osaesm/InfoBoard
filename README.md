## Getting Started

1. Clone `https://www.github.com/osaesm/InfoBoard.git`

## The overall structure

- `api/` contains the code for an ExpressJS server
- `gui/` contains the code for a NextJS GUI
- `Dockerfile.api` is the dockerfile for the API's container
- `Dockerfile.gui` is the dockerfile for the GUI's container
- There are 3 `.env` files you need from me:
    - `.env`
    - `api/.env`
    - `gui/.env.local`

## Running the GUI

1. To set up the GUI locally, `cd` into `gui/` and run `npm i`.
2. The main code for the GUI is in `gui/app/page.tsx`.
3. To run the GUI locally, from `gui/`, run `npm run dev` and go to `localhost:3000`. (If you're not on our home network, you'll also have to run your own server instance, which I'll go over next).

## Running the API

1. To set up the API locally, `cd` into `api/` and run `npm i`
2. The main code for the api is in `api/server.js`
3. To run the API locally, from `api/`, run `node server.js`. You also have to make a change to `gui/.env.local` (set `NEXT_PUBLIC_HOST_URL='localhost:<port>'` [default port for API is `2399`])
