const express = require('express')
const cheerio = require('cheerio')
const cors = require('cors')
require('dotenv').config()

const app = express()
const port = process.env.PORT_NUMBER;

app.get('/weather*', cors(), async (req, res, next) => {
  const weatherBaseUrl = 'https://api.weather.gov'
  res.status(200).json(await fetch(`${weatherBaseUrl}${req.url.substring(8)}`).then(async weatherRes => {
    return weatherRes.json();
  }));
})

app.get('/transit/diydisplay*', cors(), async (req, res, next) => {
  try {
    const ctaUrl = `https://www.transitchicago.com/diydisplay/${req.url.substring(18)}`;
    const response = await fetch(ctaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      }
    });

    // --- IMPORTANT: Handle Cloudflare's compression ---
    let html = await response.text();

    // Load HTML into Cheerio
    const $ = cheerio.load(html);

    // --- Your translated script starts here ---
    // Find all bus prediction boxes
    $('div.trackeroutputboxfg').each((index, element) => {
      const $bus = $(element);
      const text = $bus.text();

      // Extract characters at positions 1 and 2 (same as substring(1,3))
      const busNumber = text.substring(1, 3);

      let color = '';
      switch (busNumber) {
        case '50':
          color = '#4C76B3';
          break;
        case '56':
          color = '#B34C76';
          break;
        case '72':
          color = '#76B34C';
          break;
        default:
          // Logs to your Express console instead of browser console
          console.log('Unmatched bus number:', busNumber);
          break;
      }

      // If we have a color, apply it with !important
      if (color) {
        // Cheerio doesn't support !important in .css(), so we set the style attribute directly
        $bus.attr('style', `background-color: ${color} !important;`);
      }
    });
    // --- Your translated script ends here ---

    // Send the modified HTML
    res.set('Content-Type', 'text/html');
    res.send($.html());

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Failed to fetch CTA data');
  }
});

// In your Express server
app.get('/transit/traintracker*', cors(), async (req, res, next) => {
  try {
    // Build the real CTA train tracker URL using the query params 
    // (e.g., /transit/traintracker?stopid=12345)
    const ctaUrl = `https://www.transitchicago.com/traintracker/${req.url.substring(20)}`;

    const response = await fetch(ctaUrl);
    let html = await response.text();

    // Load HTML into Cheerio
    const $ = cheerio.load(html);

    // --- Your translated train tracker script starts here ---
    // Select both train arrival bar classes
    $('div.ttar_arrivalbar_blue, div.ttar_arrivalbar_blueinv').each((index, element) => {
      const $train = $(element);
      const routeText = $train.text();

      if (routeText.includes("O'Hare")) {
        // Remove blue, add blueinv
        $train.removeClass('ttar_arrivalbar_blue');
        $train.addClass('ttar_arrivalbar_blueinv');
      } else if (!routeText.includes('Forest Park')) {
        // Remove blueinv, add blue
        $train.removeClass('ttar_arrivalbar_blueinv');
        $train.addClass('ttar_arrivalbar_blue');
      }
      // If it contains "Forest Park", we do nothing (keeps the original class)
    });
    // --- Your translated script ends here ---

    // Send the modified HTML back
    res.set('Content-Type', 'text/html');
    res.send($.html());

  } catch (error) {
    console.error('Train tracker proxy error:', error);
    res.status(500).send('Failed to fetch CTA train data');
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
