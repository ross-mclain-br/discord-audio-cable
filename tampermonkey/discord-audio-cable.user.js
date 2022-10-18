// ==UserScript==
// @name         Discord Audio Cable
// @namespace    https://github.com/vctandrade/discord-audio-cable
// @version      1.1.0
// @description  An audio streaming Discord bot
// @author       Victor Andrade de Almeida
// @match        https://www.youtube.com/watch*
// @connect      localhost
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  'use strict'

  GM_registerMenuCommand('Play', () => {
    GM_xmlhttpRequest({
      method: 'PUT',
      url: 'http://localhost:6547/play',
      data: window.location.href
    })
  })

  GM_registerMenuCommand('Play (loop)', () => {
    GM_xmlhttpRequest({
      method: 'PUT',
      url: 'http://localhost:6547/play?loop=true',
      data: window.location.href
    })
  })

  GM_registerMenuCommand('Stop', () => {
    GM_xmlhttpRequest({
      method: 'PUT',
      url: 'http://localhost:6547/stop'
    })
  })
})()
