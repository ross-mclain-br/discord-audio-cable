import "./patch.js";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  Client,
  GatewayIntentBits,
  OAuth2Guild,
  VoiceBasedChannel,
} from "discord.js";
import {
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { FFmpeg } from "prism-media";
import { app, dialog, Menu, MenuItemConstructorOptions, Tray } from "electron";
import { API } from "./api.js";
import { getAudioDevices } from "./devices.js";

let connection: VoiceConnection | null;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play,
    maxMissedFrames: 250,
  },
});

const api = new API(player);

async function joinChannel(channel: VoiceBasedChannel) {
  leaveChannel();

  connection = joinVoiceChannel({
    adapterCreator: channel.guild.voiceAdapterCreator,
    guildId: channel.guild.id,
    channelId: channel.id,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  connection.subscribe(player);
}

function leaveChannel() {
  if (connection == null) {
    return;
  }

  connection.destroy();
  connection = null;
}

function selectNone() {
  api.stop();
  player.stop();
}

function selectWebAPI() {
  selectNone();
  api.start();
}

function selectAudioDevice(audioDevice: string) {
  selectNone();

  const stream = new FFmpeg({
    args: [
      "-analyzeduration",
      "0",
      "-loglevel",
      "0",
      "-f",
      "dshow",
      "-audio_buffer_size",
      "50",
      "-i",
      `audio=${audioDevice}`,
      "-f",
      "s16le",
      "-ac",
      "2",
      "-ar",
      "48000",
    ],
  });

  player.play(
    createAudioResource(stream, {
      inputType: StreamType.Raw,
    })
  );
}

async function buildTemplate(): Promise<MenuItemConstructorOptions[]> {
  const inputs: MenuItemConstructorOptions[] = [
    { label: "None", type: "radio", click: selectNone },
    { label: "Web API", type: "radio", click: selectWebAPI },
  ];

  for (const audioDevice of await getAudioDevices()) {
    const input: MenuItemConstructorOptions = {
      label: audioDevice,
      type: "radio",
      click: () => selectAudioDevice(audioDevice),
    };

    inputs.push(input);
  }

  const outputs: MenuItemConstructorOptions[] = [
    { label: "None", type: "radio", click: leaveChannel },
  ];

  const guilds = await client.guilds.fetch();
  await Promise.all(
    guilds.map(async (ref: OAuth2Guild) => {
      const guild = await ref.fetch();
      const channels = await guild.channels.fetch();

      for (const [, channel] of channels) {
        if (channel == null || !channel.isVoiceBased()) {
          continue;
        }

        const output: MenuItemConstructorOptions = {
          label: `${guild.name} > ${channel.name}`,
          type: "radio",
          click: () => joinChannel(channel),
        };

        outputs.push(output);
      }
    })
  );

  return [
    { label: "Input", submenu: inputs },
    { label: "Output", submenu: outputs },
    { type: "separator" },
    { label: "Quit", click: app.quit },
  ];
}

const rootPath =
  process.env.NODE_ENV == "development"
    ? process.cwd()
    : process.env.PORTABLE_EXECUTABLE_DIR;

const resourcesPath =
  process.env.NODE_ENV == "development" ? process.cwd() : process.resourcesPath;

async function main() {
  app.on("before-quit", leaveChannel);
  process.on("unhandledRejection", abort);

  const token = await readFile(join(rootPath, "token.txt"), "utf8");
  await client.login(token.trim());

  const template = await buildTemplate();
  const contextMenu = Menu.buildFromTemplate(template);

  const tray = new Tray(join(resourcesPath, "icon.ico"));
  tray.setToolTip("Discord Audio Cable");
  tray.setContextMenu(contextMenu);

  console.info("Ready!");
}

function abort(error: Error) {
  console.error(error);
  dialog.showMessageBoxSync({
    title: "Discord Audio Cable",
    message: error.message,
    type: "error",
  });

  app.quit();
}

app.whenReady().then(main);
