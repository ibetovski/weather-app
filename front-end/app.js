let sofiaId = 727011
function getWeatherByCityId(cityid, showDetails) {
  let url = `/get-city/`
  if (showDetails) {
    url = `/get-city-details/`
  }

  return fetch(`${url}${cityid}`)
  .then(x => x.json())
}

function toCelsious(f) {
  return Math.round(f - 273.15) + '&#176'
}

function initDom() {
  let dom = {
    container: document.getElementById('results-container'),
    buttonNoDetails: document.getElementById('show-no-details'),
    buttonWithDetails: document.getElementById('show-details'),

    render: function(content) {
      this.container.innerHTML = content
    }
  }

  dom.buttonNoDetails.addEventListener('click', (e) => {
    e.preventDefault();

    getWeatherByCityId(sofiaId)
    .then(x => buildHtml(x.list))
    .then(x => {
      dom.render(x)
    })
  })

  dom.buttonWithDetails.addEventListener('click', (e) => {
    e.preventDefault();

    getWeatherByCityId(sofiaId, true)
    .then(x => buildHtml(x.list))
    .then(x => {
      dom.render(x)
    })
  })

  return dom
}

function buildHtml(list) {
  let html = `<div class="days">`

  for (item of list) {
    if (item.main !== undefined) {
      html += buildOneDayWithDetailsHTML(item)
    } else {
      html += buildOneDayNoDetailsHTML(item)
    }
  }

  html += `</div>`

  return html;
}

function buildOneDayNoDetailsHTML(item) {
  return `
    <div class="one-day">
      <p>${item.date}</p>
      <p>Min: <span class="temp-min">${toCelsious(item.temp_min)}</span></p>
      <p>Max: <span class="temp-max">${toCelsious(item.temp_max)}</span></p>
    </div>
  `
}

function buildOneDayWithDetailsHTML(item) {
  return `
    <div class="one-day">
      <div class="temperature">
        <img src="http://openweathermap.org/img/w/${item.weather[0].icon}.png" />
        <h3 class="temp">${toCelsious(item.main.temp)}</h3>
      </div>
      <p>${item.weather[0].description}</p>
      <p>${item.dt_txt}</p>
      <p>Min: <span class="temp-min">${toCelsious(item.main.temp_min)}</span></p>
      <p>Max: <span class="temp-max">${toCelsious(item.main.temp_max)}</span></p>
    </div>
  `
}

function init() {
  let dom = initDom();

  dom.render('Please wait ...');

  getWeatherByCityId(sofiaId)
  .then(x => buildHtml(x.list))
  .then(x => {
    dom.render(x)
  })
}
