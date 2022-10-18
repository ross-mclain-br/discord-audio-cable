require('./patch')

const discord = require('discord.js')
const fs = require('fs/promises')
const path = require('path')
const prism = require('prism-media')
const voice = require('@discordjs/voice')

const { Menu, Tray, app, dialog } = require('electron')
const { Server } = require('./server')
const { getAudioDevices } = require('./audio-devices')

let connection

const client = new discord.Client({
  intents: [discord.GatewayIntentBits.Guilds, discord.GatewayIntentBits.GuildVoiceStates]
})

const player = voice.createAudioPlayer({
  behaviors: {
    noSubscriber: voice.NoSubscriberBehavior.Play,
    maxMissedFrames: 250
  }
})

const server = new Server(player)
const resourcesPath = process.env.NODE_ENV === 'development'
  ? __dirname
  : process.resourcesPath

function leave () {
  if (connection === undefined) {
    return
  }

  connection.destroy()
  connection = undefined
}

async function join (channel) {
  leave()

  connection = voice.joinVoiceChannel({
    adapterCreator: channel.guild.voiceAdapterCreator,
    guildId: channel.guild.id,
    channelId: channel.id
  })

  try {
    await voice.entersState(connection, voice.VoiceConnectionStatus.Ready, 30_000)
  } catch (err) {
    connection.destroy()
    throw err
  }

  connection.subscribe(player)
}

function selectNone () {
  server.stop()
  player.stop()
}

function selectYouTube () {
  selectNone()
  server.start()
}

function selectAudioDevice (audioDevice) {
  selectNone()

  const stream = new prism.FFmpeg({
    args: [
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-f', 'dshow',
      '-audio_buffer_size', '50',
      '-i', `audio=${audioDevice}`,
      '-f', 's16le',
      '-ac', '2',
      '-ar', '48000'
    ]
  })

  player.play(
    voice.createAudioResource(
      stream,
      {
        inputType: voice.StreamType.Raw
      }
    )
  )
}

async function buildTemplate () {
  const inputs = [
    { label: 'None', type: 'radio', click: selectNone },
    { label: 'YouTube API', type: 'radio', click: selectYouTube }
  ]

  for (const audioDevice of await getAudioDevices()) {
    const input = {
      label: audioDevice,
      type: 'radio',
      click: () => selectAudioDevice(audioDevice)
    }

    inputs.push(input)
  }

  const outputs = [
    { label: 'None', type: 'radio', click: leave }
  ]

  async function getVoiceChannels (ref) {
    const guild = await ref.fetch()
    const channels = await guild.channels.fetch()

    for (const [, channel] of channels) {
      if (channel.isVoiceBased()) {
        const output = {
          label: `${guild.name} > ${channel.name}`,
          type: 'radio',
          click: () => join(channel)
        }

        outputs.push(output)
      }
    }
  }

  const guilds = await client.guilds.fetch()
  await Promise.all(guilds.map(getVoiceChannels))

  return [
    { label: 'Input', submenu: inputs },
    { label: 'Output', submenu: outputs },
    { type: 'separator' },
    { label: 'Quit', click: app.quit }
  ]
}

async function main () {
  app.on('before-quit', leave)

  const token = await fs.readFile(path.join(__dirname, 'token.txt'), 'utf8')
  await client.login(token.trim())

  const template = await buildTemplate()
  const contextMenu = Menu.buildFromTemplate(template)

  const tray = new Tray(path.join(resourcesPath, 'icon.ico'))
  tray.setToolTip('Discord Audio Cable')
  tray.setContextMenu(contextMenu)
}

app.whenReady().then(main).catch(error => {
  dialog.showMessageBoxSync({ title: 'Discord Audio Cable', message: error.message, type: 'error' })
  app.quit()
})
