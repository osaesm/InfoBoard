const express = require('express')
const { request } = require('http')
const app = express()
const port = 2384

app.get('/*', async (req, res) => {
  transitBaseUrl = 'http://api.pugetsound.onebusaway.org'
  res.header("Access-Control-Allow-Origin", "*");
  transitRes = await fetch(`${transitBaseUrl}${req.url}`);
  console.log(transitRes.status);
  retData = await transitRes.json().then(d => d.data);
  console.log(retData);
  res.json(retData);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})