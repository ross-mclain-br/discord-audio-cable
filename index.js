require('./patch')

const fs = require('fs/promises')
const path = require('path')

const { Menu, Tray, app, dialog } = require('electron')
const { Client, GatewayIntentBits } = require('discord.js')
const { createAudioPlayer, createAudioResource, entersState, joinVoiceChannel, NoSubscriberBehavior, StreamType, VoiceConnectionStatus } = require('@discordjs/voice')
const { FFmpeg } = require('prism-media')
const { getAudioDevices } = require('./audio-devices')

let connection

const resourcesPath = process.env.NODE_ENV === 'development'
  ? __dirname
  : process.resourcesPath

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
})

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play,
    maxMissedFrames: 250
  }
})

function leave () {
  if (connection == null) {
    return
  }

  connection.destroy()
  connection = null
}

async function join (channel) {
  leave()

  connection = joinVoiceChannel({
    adapterCreator: channel.guild.voiceAdapterCreator,
    guildId: channel.guild.id,
    channelId: channel.id
  })

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
  } catch (err) {
    connection.destroy()
    throw err
  }

  connection.subscribe(player)
}

function selectAudioDevice (audioDevice) {
  if (audioDevice === null) {
    player.stop()
    return
  }

  const input = new FFmpeg({
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
    createAudioResource(
      input,
      {
        inputType: StreamType.Raw
      }
    )
  )
}

async function buildTemplate () {
  const inputs = [
    { label: 'None', type: 'radio', click: () => selectAudioDevice(null) }
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
