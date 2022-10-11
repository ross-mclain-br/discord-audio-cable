const cp = require('child_process')
const ffmpegPath = require('ffmpeg-static')

function * parse (data) {
  for (const match of data.matchAll(/"(.*)" \(audio\)/g)) {
    yield match[1]
  }
}

function getAudioDevices () {
  const result = new Promise(resolve => {
    cp.exec(`${ffmpegPath} -f dshow -list_devices true -i dummy`, (_error, _stdout, stderr) => {
      resolve(parse(stderr))
    })
  })

  return result
}

module.exports = {
  getAudioDevices
}
