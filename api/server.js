const express = require('express')
const cors = require('cors')

const app = express()
const port = 2384

app.use(cors());

app.get('/*', async (req, res) => {
  const transitBaseUrl = 'http://api.pugetsound.onebusaway.org'
  const weatherBaseUrl = 'https://api.weather.gov'
  // options are '/transit' and '/weather' both are 8 characters
  if (req.url.substring(0, 8).localeCompare('/transit') == 0) {
    return res.status(200).json(await fetch(`${transitBaseUrl}${req.url.substring(8)}`).then(transitRes => transitRes.json()));
  }
  console.log(`${weatherBaseUrl}${req.url.substring(8)}`)
  return res.status(200).json(await fetch(`${weatherBaseUrl}${req.url.substring(8)}`).then(weatherRes => weatherRes.json()));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
