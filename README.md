### Web server:

Your nodejs version should be v7 or newer.

To start the web server you have to provide environment variable for you app key:

```bash
export WEATHER_APP_KEY=you_app_key
```

After you have the environment variable. You can start the web server with:

```bash
npm install
node index.js
```

Open `http://localhost:8181` in your browser

### Web server Api

```
GET: /get-city/{CITY_ID} - will return the reduced data for 5 days
GET: /get-city-details/{CITY_ID} - will return full non-reduced data
```

### WeatherAPI Class

## Usage

Initialize:

```js
let WeatherAPI = require('./lib/weather-api')
let weatherApi = new WeatherAPI(APPKEY)
```

Will throw error if the APPKEY is missing.

Getting weather by cityid:

```js
weatherApi.get(cityId)
```

## Tests

Run:

```bash
npm test
```