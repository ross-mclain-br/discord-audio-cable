const Module = require('module')

function wrap (object, method, wrapper) {
  const original = object[method]
  object[method] = wrapper(original)
}

wrap(Module, '_load', original => {
  return function (request) {
    let result = original.apply(this, arguments)

    if (request === 'ffmpeg-static') {
      result = result.replace('app.asar', 'app.asar.unpacked')
    }

    return result
  }
})
