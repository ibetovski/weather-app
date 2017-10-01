'use strict'
// ^ by using strict mode we cat compare to undefined instead of using typeof

let fs          = require('fs')
let os          = require('os')
let curlrequest = require('curlrequest')

// How many results we want to get.
const RESULTS_LIMIT = 5

const WEATHER_WEBSITE_API_URL = `http://api.openweathermap.org/data/2.5/forecast?id={cityID}&cnd=${RESULTS_LIMIT}&appid={MYKEY}`
const CACHE_FILE_PATH         = `${os.tmpdir()}/last-response.json`
// It's written on the website we can make request one per 10 minutes.
// Let's stay safe and make every new request on 12 minutes.
// If the 12 minutes haven't passed, we should get the content from the cache.
const CACHE_EXPIRE_MINUTES    = 12

/**
 * We will use this snippet of code more than once that's why we put it into
 * a function to be sure everything needed will be executed as expected.
 * Especially caching into a file.
 * 
 * @return {[type]} [description]
 */
function getFromWebSite(key, cityid) {
  return new Promise((res, rej) => {
    curlrequest.request({
      url: WEATHER_WEBSITE_API_URL
        .replace('{MYKEY}', key)
        .replace('{cityID}', cityid)
    }, (err, response) => {

      if (err) {
        rej(new Error(err))
        return
      }

      // the entire app should work with object, not a string
      response = JSON.parse(response)

      // keep the response into a file.
      if (Number(response.cod) === 200) {
        fs.writeFile(CACHE_FILE_PATH, JSON.stringify(response), (err) => {
          if (!err) {
            // resolve the wrapping promise.
            // This could be avoided by promisifying the fs methods but I don't
            // want to do it for now :)
            res(response)
          } else {
            rej(err)
          }
        })
      } else {
        rej(JSON.stringify(response))
      }
    })
  })
}

module.exports = class WeatherAPI {
  constructor(key) {
    if (!key) {
      throw new Error('weather app key is missing. Please provide it as a first argument')
    }

    this.key = key
  }

  /**
   * Will make one request in 12 minutes (according to the config above)
   * And will keep the result into a file to prevent more requests.
   * 
   * @param  {String|Number} cityid Which city id we would like to get the
   *                                weather for
   * @return {Promise}
   */
  get(cityid) {
    if (cityid === undefined) {
      throw new Error('cityid is missing')
    }

    return new Promise((res, rej) => {
      fs.stat(CACHE_FILE_PATH, (err, stats) => {
        // the file is missing.
        if (err && err.code === 'ENOENT') {
          res(getFromWebSite(this.key, cityid))
        } else if (!this.isCacheExpired(stats)) {
          fs.readFile(CACHE_FILE_PATH, (err, content) => {
            if (!err) {
              res(JSON.parse(content))
            } else {
              rej(err)
            }
          })
        } else {
          // seems like the cache has expired, we can make a new request and keep it
          // into the file.
          res(getFromWebSite(this.key, cityid))
        }
      })
    })
  }

  /**
   * If the cache of the cache file has expired.
   * 
   * @param  {Object}  stats instance of fs.stat
   * @return {Boolean}
   */
  isCacheExpired(stats) {
    return (Date.now() - stats.mtime) / 1000 / 60 >= CACHE_EXPIRE_MINUTES
  }

  /**
   * Will get the max and min for every day by removing the rest of the items.
   * 
   * @param  {Array} listToReduce 
   * @return {Array}
   */
  reduce(listToReduce) {

    let lastMin
    let lastMax
    let lastDateDay

    let result = []

    let minMaxValues = {
      temp_min: null,
      temp_max: null,
      date: null
    }
    
    // it's not the best code but it's working.
    listToReduce.forEach((item, i) => {
      let date = item.dt_txt.split(' ')[0]

      if (minMaxValues.date !== null && date !== minMaxValues.date) {
        result.push(minMaxValues)

        minMaxValues = {
          temp_min: null,
          temp_max: null,
          date: null
        }
      }

      if (minMaxValues.temp_min === null) {
        minMaxValues.temp_min = item.main.temp_min
      } else if (item.main.temp_min < minMaxValues.temp_min) {
        minMaxValues.temp_min = item.main.temp_min
      }

      if (minMaxValues.temp_max === null) {
        minMaxValues.temp_max = item.main.temp_max
      } else if (item.main.temp_max > minMaxValues.temp_max) {
        minMaxValues.temp_max = item.main.temp_max
      }

      if (i === listToReduce.length - 1) {
        result.push(minMaxValues)
      }

      minMaxValues.date = date
    })

    return result
  }
}

// expose the URL template for reference from outside.
module.exports.URL_TEMPLATE = WEATHER_WEBSITE_API_URL
// expose the path to the cache file
module.exports.CACHE_FILE_PATH = CACHE_FILE_PATH