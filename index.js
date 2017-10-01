let http       = require('http')
let fs         = require('fs')
let WeatherAPI = require('./lib/weather-api')

const PORT = 8181
if (!process.env.WEATHER_APP_KEY) {
  throw new Error(`Environment variable WEATHER_APP_KEY is missing`)
  process.exit(1)
}

let weatherApi = new WeatherAPI(process.env.WEATHER_APP_KEY)

const FRONTEND_DIR = './front-end/'

function getResult(url) {
  let showDetails = url.includes('/get-city-details/')

  let cityid
  if (showDetails) {
    cityid = url.replace('/get-city-details/', '')
  } else {
    cityid = url.replace('/get-city/', '')
  }

  let sofiaId = 727011

  return weatherApi.get(sofiaId)
  .then(x => {
    if (!showDetails) {
      x.list = weatherApi.reduce(x.list)
    }
    return x
  })
  .then(x => {
    console.log('Response from weatherApi:', x)
    return JSON.stringify(x)
  })
  .catch(e => {
    console.log("error from weather api:", e)
    return e
  })
}

const server = http.createServer((req, res) => {
  if (req.url.includes('/get-city')) {
    getResult(req.url)
    .then(x => {
      res.end(x)
    })
  } else if (req.url.includes('/file/')) {
    let fileToSend = req.url
      .replace('/file/', '')
      .replace('/../', '') // high level sanitizing the request file path

    fs.readFile(`${FRONTEND_DIR}/${fileToSend}`, (err, content) => {
      res.end(content)
    })

  } else {
    fs.readFile(`${FRONTEND_DIR}/index.html`, (err, content) => {
      res.end(content)
    })
  }
})

server.listen(PORT)
console.log(`
  Starting web server...

  Open http://localhost:${PORT}
`)