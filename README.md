# Weather APP wanna be

## Web server:

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

## Web server Api

```
GET: /                           - will render the home page
GET: /get-city/{CITY_ID}         - will return the reduced data for 5 days
GET: /get-city-details/{CITY_ID} - will return full non-reduced data
```

## WeatherAPI Class

This class will execute requests to get a city's weather data from https://openweathermap.org/forecast5

And since OpenWeatherMap allows one request per 10 minutes (or your APPKEY will be blocked for a while) the result from the first request will be kept into a file in your temp folder.

The cache file will expire on every 12 minutes (stay on the safe side regarding the 10 minutes. I don't want to take the risk :))

## Usage

### Initialize:

```js
let WeatherAPI = require('./lib/weather-api')
let weatherApi = new WeatherAPI(APPKEY)
```

Will throw error if the APPKEY is missing.

### Getting weather by cityid:

```js
weatherApi.get(cityId)
```

### Reduce the results function

The OpenWeatherMap JSON response contains list property. Pass it to the function and it will combine all results by date keeping only the minimal and maximal temperature for the day.

```js
weatherApi.reduce(response.list)
```

## Tests

Run:

```bash
npm test
```
*No HTTP requests and no files were harmed during the unit tests execution (They are fully isolated by stubing the curlrequest and fs methods)*