'use strict'

// we need the fs to stub writing into a file.
let fs          = require('fs')
let {expect}    = require('chai')
let sinon       = require('sinon')
let curlrequest = require('curlrequest')
let WeatherAPI  = require('../lib/weather-api')

// the fake response is taken from https://openweathermap.org/forecast5
let fakeResponse = {
  "city": {
    "id": 1851632,
    "name": "Shuzenji",
    "coord": {
      "lon": 138.933334,
      "lat": 34.966671
    },
    "country": "JP",
    "cod": "200",
    "message": 0.0045,
    "cnt": 38,
    "list": [{
      "dt": 1406106000,
      "main": {
        "temp": 298.77,
        "temp_min": 298.77,
        "temp_max": 298.774,
        "pressure": 1005.93,
        "sea_level": 1018.18,
        "grnd_level": 1005.93,
        "humidity": 87,
        "temp_kf": 0.26
      },
      "weather": [{
        "id": 804,
        "main": "Clouds",
        "description": "overcast clouds",
        "icon": "04d"
      }],
      "clouds": {
        "all": 88
      },
      "wind": {
        "speed": 5.71,
        "deg": 229.501
      },
      "sys": {
        "pod": "d"
      },
      "dt_txt": "2014-07-23 09:00:00"
    }]
  }
}

describe('Weather API', () => {
  let weatherApi

  function stubStats(isOK) {
    if (typeof fs.stat.restore === 'function') {
      fs.stat.restore()
    }

    let stub = sinon.stub(fs, 'stat')
    stub.callsFake((destination, cb) => {
      if (isOK) {
        cb(null, {mtime: ''})
      } else {
        cb({code: 'ENOENT'})
      }
    })
  }

  function stubExpiredCache(isExpired) {
    if (typeof weatherApi.isCacheExprited.restore === 'function') {
      weatherApi.isCacheExprited.restore()
    }

    sinon.stub(weatherApi, 'isCacheExprited').returns(isExpired)
  }

  beforeEach(() => {
    // for all tests make the class to be initialized as expected to be working
    // we will test the init required params in a new instace
    weatherApi = new WeatherAPI('key123')
    sinon.stub(curlrequest, 'request').returns(Promise.resolve(fakeResponse))
    // Faking the fs. methods to act in the happy scenario.
    // we want to write a file
    // and we want to read a file.
    let writeFileStub = sinon.stub(fs, 'writeFile')
    writeFileStub.callsFake((destination, content, callback) => {
      callback(null)
    })

    let readFileStub = sinon.stub(fs, 'readFile')
    readFileStub.callsFake((destination, callback) => {
      callback(null, JSON.stringify(fakeResponse))
    })

    // by default we want to stub the fs.stat in a way the cache file
    // doesn't exist
    stubStats(false)
  })

  afterEach(() => {
    if (typeof weatherApi.isCacheExprited.restore === 'function') {
      weatherApi.isCacheExprited.restore()
    }

    weatherApi = null
    curlrequest.request.restore()
    fs.writeFile.restore()
    fs.readFile.restore()

    if (typeof fs.stat.restore === 'function') {
      fs.stat.restore()
    }

  })

  it('should throw an error if api key is missing', () => {
    expect(() => {
      weatherApi = new WeatherAPI()
    }).throw(/weather app key is missing/)
  })

  it('should throw an error if city id is missing', () => {
    expect(() => {
      weatherApi.get()
    }).throw(/cityid is missing/)
  })

  it('should add the cityid to the request\'s URL', async () => {
    await weatherApi.get(123)

    let expectedUrl = WeatherAPI.URL_TEMPLATE
      .replace('{cityID}', 123)
      .replace('{MYKEY}', weatherApi.key)

    sinon.assert.calledWith(curlrequest.request, {url: expectedUrl})
  })

  it('should keep the response in a file', async () => {
    await weatherApi.get(123)
    sinon.assert.calledWith(fs.writeFile, WeatherAPI.CACHE_FILE_PATH, JSON.stringify(fakeResponse))
  })

  it('should get the data from the file before getting it from the website', async () => {
    stubStats(true)
    stubExpiredCache(false)

    await weatherApi.get(123)
    sinon.assert.notCalled(curlrequest.request)

    sinon.assert.calledWith(fs.readFile, WeatherAPI.CACHE_FILE_PATH)
  })

  it('should return data from cache that is the same as the fakeResponse', async () => {
    stubStats(true)

    let content = await weatherApi.get(123)
    expect(content).to.deep.equal(fakeResponse)
  })

  it('should make new request if the cache file has expired', async () => {
    stubStats(true)
    stubExpiredCache(true)

    await weatherApi.get(123)
    sinon.assert.called(curlrequest.request)
  })
})