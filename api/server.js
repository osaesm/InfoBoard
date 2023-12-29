const express = require('express')
const cors = require('cors')

const app = express()
const port = 2384

app.get('/transit*', cors(), async (req, res, next) => {
  const transitBaseUrl = 'http://api.pugetsound.onebusaway.org'
  res.status(200).json(await fetch(`${transitBaseUrl}${req.url.substring(8)}`).then(async transitRes => {
    return transitRes.json()
  }));
})

app.get('/weather*', async (req, res) => {
  const weatherBaseUrl = 'https://api.weather.gov'
  console.log(`${weatherBaseUrl}${req.url.substring(8)}`)
  res.status(200).json(await fetch(`${weatherBaseUrl}${req.url.substring(8)}`).then(async weatherRes => {
    return weatherRes.json();
  }));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
