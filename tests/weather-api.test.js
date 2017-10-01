'use strict'

// we need the fs to stub writing into a file.
let fs          = require('fs')
let {expect}    = require('chai')
let sinon       = require('sinon')
let curlrequest = require('curlrequest')
let WeatherAPI  = require('../lib/weather-api')

// the fake response is taken from https://openweathermap.org/forecast5
let fakeResponse = {
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
    if (typeof weatherApi.isCacheExpired.restore === 'function') {
      weatherApi.isCacheExpired.restore()
    }

    sinon.stub(weatherApi, 'isCacheExpired').returns(isExpired)
  }

  beforeEach(() => {
    // for all tests make the class to be initialized as expected to be working
    // we will test the init required params in a new instace
    weatherApi = new WeatherAPI('key123')
    let curlStub = sinon.stub(curlrequest, 'request')
    curlStub.callsFake((options, cb) => {
      cb(null, JSON.stringify(fakeResponse))
    })
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
    if (typeof weatherApi.isCacheExpired.restore === 'function') {
      weatherApi.isCacheExpired.restore()
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

  it('should not override the cache if the response is with error', (done) => {
    stubStats(true)
    stubExpiredCache(true)

    curlrequest.request.restore()
    let curlStub = sinon.stub(curlrequest, 'request')
    curlStub.callsFake((options, cb) => {
      cb(null, {
        "cod": 401,
        "message": "Invalid API key. Please see http://openweathermap.org/faq#error401 for more info."
      });
    })

    weatherApi.get(123)
    .catch((e) => {
      sinon.assert.notCalled(fs.writeFile)
      done();
    })
  })

  it('should reduce the data from 8 elements and get min and max temperatures', function() {
    let listToReduce = [{
      "dt": 1506902400,
      "main": {
        "temp": 275.5,
        "temp_min": 275.063,
        "temp_max": 275.5,
        "pressure": 941.89,
        "sea_level": 1040.17,
        "grnd_level": 941.89,
        "humidity": 94,
        "temp_kf": 0.44
      },
      "weather": [{
        "id": 801,
        "main": "Clouds",
        "description": "few clouds",
        "icon": "02n"
      }],
      "clouds": {
        "all": 20
      },
      "wind": {
        "speed": 1.12,
        "deg": 92.0031
      },
      "rain": {},
      "sys": {
        "pod": "n"
      },
      "dt_txt": "2017-10-02 00:00:00"
      }, {
        "dt": 1506913200,
        "main": {
          "temp": 274.473,
          "temp_min": 274.473,
          "temp_max": 274.473,
          "pressure": 941.85,
          "sea_level": 1040.53,
          "grnd_level": 941.85,
          "humidity": 100,
          "temp_kf": 0
        },
        "weather": [{
          "id": 801,
          "main": "Clouds",
          "description": "few clouds",
          "icon": "02n"
        }],
        "clouds": {
          "all": 20
        },
        "wind": {
          "speed": 1.16,
          "deg": 113.5
        },
        "rain": {},
        "sys": {
          "pod": "n"
        },
        "dt_txt": "2017-10-02 03:00:00"
      }, {
        "dt": 1506924000,
        "main": {
          "temp": 278.148,
          "temp_min": 278.148,
          "temp_max": 278.148,
          "pressure": 942.47,
          "sea_level": 1041.11,
          "grnd_level": 942.47,
          "humidity": 98,
          "temp_kf": 0
        },
        "weather": [{
          "id": 500,
          "main": "Rain",
          "description": "light rain",
          "icon": "10d"
        }],
        "clouds": {
          "all": 24
        },
        "wind": {
          "speed": 1.16,
          "deg": 128.009
        },
        "rain": {
          "3h": 0.005
        },
        "sys": {
          "pod": "d"
        },
        "dt_txt": "2017-10-02 06:00:00"
      }, {
        "dt": 1506934800,
        "main": {
          "temp": 285.882,
          "temp_min": 285.882,
          "temp_max": 285.882,
          "pressure": 942.88,
          "sea_level": 1039.98,
          "grnd_level": 942.88,
          "humidity": 77,
          "temp_kf": 0
        },
        "weather": [{
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        }],
        "clouds": {
          "all": 0
        },
        "wind": {
          "speed": 1.62,
          "deg": 51.001
        },
        "rain": {},
        "sys": {
          "pod": "d"
        },
        "dt_txt": "2017-10-02 09:00:00"
      }, {
        "dt": 1506945600,
        "main": {
          "temp": 288.452,
          "temp_min": 288.452,
          "temp_max": 288.452,
          "pressure": 942.03,
          "sea_level": 1038.2,
          "grnd_level": 942.03,
          "humidity": 67,
          "temp_kf": 0
        },
        "weather": [{
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        }],
        "clouds": {
          "all": 0
        },
        "wind": {
          "speed": 1.57,
          "deg": 26.506
        },
        "rain": {},
        "sys": {
          "pod": "d"
        },
        "dt_txt": "2017-10-02 12:00:00"
      }, {
        "dt": 1506956400,
        "main": {
          "temp": 287.556,
          "temp_min": 287.556,
          "temp_max": 287.556,
          "pressure": 941.41,
          "sea_level": 1037.66,
          "grnd_level": 941.41,
          "humidity": 64,
          "temp_kf": 0
        },
        "weather": [{
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        }],
        "clouds": {
          "all": 0
        },
        "wind": {
          "speed": 1.41,
          "deg": 41.5012
        },
        "rain": {},
        "sys": {
          "pod": "d"
        },
        "dt_txt": "2017-10-02 15:00:00"
      }, {
        "dt": 1506967200,
        "main": {
          "temp": 280.461,
          "temp_min": 280.461,
          "temp_max": 280.461,
          "pressure": 942.05,
          "sea_level": 1039.19,
          "grnd_level": 942.05,
          "humidity": 91,
          "temp_kf": 0
        },
        "weather": [{
          "id": 801,
          "main": "Clouds",
          "description": "few clouds",
          "icon": "02n"
        }],
        "clouds": {
          "all": 12
        },
        "wind": {
          "speed": 1.16,
          "deg": 59.0041
        },
        "rain": {},
        "sys": {
          "pod": "n"
        },
        "dt_txt": "2017-10-02 18:00:00"
      }, {
        "dt": 1506978000,
        "main": {
          "temp": 276.83,
          "temp_min": 276.83,
          "temp_max": 276.83,
          "pressure": 942.31,
          "sea_level": 1040.06,
          "grnd_level": 942.31,
          "humidity": 93,
          "temp_kf": 0
        },
        "weather": [{
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01n"
        }],
        "clouds": {
          "all": 0
        },
        "wind": {
          "speed": 1.31,
          "deg": 107.501
        },
        "rain": {},
        "sys": {
          "pod": "n"
        },
        "dt_txt": "2017-10-02 21:00:00"
    }]

    // split the data per date
    let res = weatherApi.reduce(listToReduce);
    expect(res).to.have.lengthOf(1);
    expect(res[0].temp_min).to.equal(274.473);
    expect(res[0].temp_max).to.equal(288.452);
  });

  it('should group by date when reducing', function() {
    let listToReduce = [{
      "dt": 1506902400,
      "main": {
        "temp": 275.5,
        "temp_min": 275.063,
        "temp_max": 275.5,
        "pressure": 941.89,
        "sea_level": 1040.17,
        "grnd_level": 941.89,
        "humidity": 94,
        "temp_kf": 0.44
      },
      "weather": [{
        "id": 801,
        "main": "Clouds",
        "description": "few clouds",
        "icon": "02n"
      }],
      "clouds": {
        "all": 20
      },
      "wind": {
        "speed": 1.12,
        "deg": 92.0031
      },
      "rain": {},
      "sys": {
        "pod": "n"
      },
      "dt_txt": "2017-10-02 00:00:00"
      }, {
        "dt": 1506913200,
        "main": {
          "temp": 274.473,
          "temp_min": 274.473,
          "temp_max": 274.473,
          "pressure": 941.85,
          "sea_level": 1040.53,
          "grnd_level": 941.85,
          "humidity": 100,
          "temp_kf": 0
        },
        "weather": [{
          "id": 801,
          "main": "Clouds",
          "description": "few clouds",
          "icon": "02n"
        }],
        "clouds": {
          "all": 20
        },
        "wind": {
          "speed": 1.16,
          "deg": 113.5
        },
        "rain": {},
        "sys": {
          "pod": "n"
        },
        "dt_txt": "2017-10-02 03:00:00"
      }, {
        "dt": 1506924000,
        "main": {
          "temp": 278.148,
          "temp_min": 278.148,
          "temp_max": 278.148,
          "pressure": 942.47,
          "sea_level": 1041.11,
          "grnd_level": 942.47,
          "humidity": 98,
          "temp_kf": 0
        },
        "weather": [{
          "id": 500,
          "main": "Rain",
          "description": "light rain",
          "icon": "10d"
        }],
        "clouds": {
          "all": 24
        },
        "wind": {
          "speed": 1.16,
          "deg": 128.009
        },
        "rain": {
          "3h": 0.005
        },
        "sys": {
          "pod": "d"
        },
        "dt_txt": "2017-10-02 06:00:00"
      }, {
        "dt": 1506934800,
        "main": {
          "temp": 285.882,
          "temp_min": 285.882,
          "temp_max": 285.882,
          "pressure": 942.88,
          "sea_level": 1039.98,
          "grnd_level": 942.88,
          "humidity": 77,
          "temp_kf": 0
        },
        "weather": [{
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        }],
        "clouds": {
          "all": 0
        },
        "wind": {
          "speed": 1.62,
          "deg": 51.001
        },
        "rain": {},
        "sys": {
          "pod": "d"
        },
        "dt_txt": "2017-10-02 09:00:00"
      }, {
        "dt": 1506945600,
        "main": {
          "temp": 288.452,
          "temp_min": 288.452,
          "temp_max": 288.452,
          "pressure": 942.03,
          "sea_level": 1038.2,
          "grnd_level": 942.03,
          "humidity": 67,
          "temp_kf": 0
        },
        "weather": [{
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        }],
        "clouds": {
          "all": 0
        },
        "wind": {
          "speed": 1.57,
          "deg": 26.506
        },
        "rain": {},
        "sys": {
          "pod": "d"
        },
        "dt_txt": "2017-10-02 12:00:00"
      }, {
        "dt": 1506956400,
        "main": {
          "temp": 287.556,
          "temp_min": 287.556,
          "temp_max": 287.556,
          "pressure": 941.41,
          "sea_level": 1037.66,
          "grnd_level": 941.41,
          "humidity": 64,
          "temp_kf": 0
        },
        "weather": [{
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        }],
        "clouds": {
          "all": 0
        },
        "wind": {
          "speed": 1.41,
          "deg": 41.5012
        },
        "rain": {},
        "sys": {
          "pod": "d"
        },
        "dt_txt": "2017-10-02 15:00:00"
      }, {
        "dt": 1506967200,
        "main": {
          "temp": 280.461,
          "temp_min": 280.461,
          "temp_max": 280.461,
          "pressure": 942.05,
          "sea_level": 1039.19,
          "grnd_level": 942.05,
          "humidity": 91,
          "temp_kf": 0
        },
        "weather": [{
          "id": 801,
          "main": "Clouds",
          "description": "few clouds",
          "icon": "02n"
        }],
        "clouds": {
          "all": 12
        },
        "wind": {
          "speed": 1.16,
          "deg": 59.0041
        },
        "rain": {},
        "sys": {
          "pod": "n"
        },
        "dt_txt": "2017-10-02 18:00:00"
      }, {
        "dt": 1506978000,
        "main": {
          "temp": 276.83,
          "temp_min": 276.83,
          "temp_max": 276.83,
          "pressure": 942.31,
          "sea_level": 1040.06,
          "grnd_level": 942.31,
          "humidity": 93,
          "temp_kf": 0
        },
        "weather": [{
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01n"
        }],
        "clouds": {
          "all": 0
        },
        "wind": {
          "speed": 1.31,
          "deg": 107.501
        },
        "rain": {},
        "sys": {
          "pod": "n"
        },
        "dt_txt": "2017-10-02 21:00:00"
    }, {
      "dt": 1507291200,
      "main": {
        "temp": 288.745,
        "temp_min": 288.745,
        "temp_max": 288.745,
        "pressure": 937.77,
        "sea_level": 1033.14,
        "grnd_level": 937.77,
        "humidity": 60,
        "temp_kf": 0
      },
      "weather": [{
        "id": 800,
        "main": "Clear",
        "description": "clear sky",
        "icon": "01d"
      }],
      "clouds": {
        "all": 0
      },
      "wind": {
        "speed": 1.62,
        "deg": 316.504
      },
      "rain": {},
      "sys": {
        "pod": "d"
      },
      "dt_txt": "2017-10-06 12:00:00"
    }]
    
    // split the data per date
    let res = weatherApi.reduce(listToReduce);
    expect(res).to.have.lengthOf(2);
    expect(res[1].temp_min).to.equal(288.745);
    expect(res[1].temp_max).to.equal(288.745);
  });
})