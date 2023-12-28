const express = require('express')
const cors = require('cors')

const app = express()
const port = 2384

app.use(cors());

app.get('/*', async (req, res) => {
  const transitBaseUrl = 'http://api.pugetsound.onebusaway.org'
  return res.status(200).json(await fetch(`${transitBaseUrl}${req.url}`).then(transitRes => transitRes.json()));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
