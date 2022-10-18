const http = require('http')
const play = require('play-dl')
const voice = require('@discordjs/voice')

class Server {
  constructor (player) {
    this.player = player

    this.routes = new Map()
    this.routes.set('/play', this.handlePlay)
    this.routes.set('/stop', this.handleStop)

    this.app = http.createServer(async (request, response) => {
      const result = await this.route(request)
      response.writeHead(result)
      response.end()
    })
  }

  start () {
    this.app.listen(6547, 'localhost')
  }

  stop () {
    this.app.close()
  }

  route (request) {
    const { path, parameters } = parseURL(request.url)

    const handle = this.routes.get(path)
    if (request.method !== 'PUT' || handle === undefined) {
      return 404
    }

    const buffer = []
    request.on('data', data => {
      buffer.push(data)
    })

    return new Promise(resolve => {
      request.on('end', async () => {
        const body = Buffer.concat(buffer).toString()
        try {
          await handle.apply(this, [parameters, body])
        } catch (error) {
          return resolve(500)
        }

        resolve(200)
      })
    })
  }

  async handlePlay (parameters, body) {
    const source = await play.stream(body, { discordPlayerCompatibility: true })

    if (parameters.loop) {
      source.stream.on('end', () => this.handlePlay(parameters, body))
    }

    this.player.play(
      voice.createAudioResource(
        source.stream,
        {
          inputType: source.type
        }
      )
    )
  }

  handleStop () {
    this.player.stop()
  }
}

function parseURL (url) {
  const [path, query] = url.split('?')
  const parameters = {}

  if (query) {
    for (const parameter of query.split('&')) {
      const [key, value] = parameter.split('=')
      parameters[key] = value
    }
  }

  return { path, parameters }
}

module.exports = {
  Server
}
