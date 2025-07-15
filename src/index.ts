//import "./patch.js";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  Client,
  GatewayIntentBits,
  OAuth2Guild,
  VoiceBasedChannel,
} from "discord.js";
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  generateDependencyReport,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { FFmpeg } from "prism-media";
import { app, dialog, Menu, MenuItemConstructorOptions, Tray } from "electron";


import { getAudioDevices } from "./devices.js";


let connection: VoiceConnection | null;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play,
    maxMissedFrames: Infinity,
  },
  debug: true,
});


async function joinChannel(channel: VoiceBasedChannel) {
  leaveChannel();

  console.log(`Joining voice channel: ${channel.name} in ${channel.guild.name}`);

  connection = joinVoiceChannel({
    adapterCreator: channel.guild.voiceAdapterCreator,
    guildId: channel.guild.id,
    channelId: channel.id,
    debug: true,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  console.log("Voice connection ready");

  connection.subscribe(player);
  console.log("Player subscribed to voice connection");
  
  // Add connection status monitoring
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log("Voice connection is ready");
  });
  
  connection.on(VoiceConnectionStatus.Disconnected, () => {
    console.log("Voice connection disconnected");
  });
  
  connection.on(VoiceConnectionStatus.Signalling, () => {
    console.log("Voice connection signalling");
  });
}

function leaveChannel() {
  if (connection == null) {
    return;
  }

  connection.destroy();
  connection = null;
}

function selectNone() {
  player.stop();
  console.log("Audio stopped");
}

function testTone() {
  selectNone();
  console.log("Playing test tone...");
  
  // Create a simple test tone using FFmpeg
  const stream = new FFmpeg({
    args: [
      "-loglevel", "error",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=10",
      "-f", "s16le",
      "-ac", "2",
      "-ar", "48000",
      "-acodec", "pcm_s16le"
    ],
  });

  stream.on("error", (error) => {
    console.error("Test tone FFmpeg error:", error);
  });

  try {
    if (!connection) {
      console.error("No voice connection available. Please join a voice channel first.");
      return;
    }
    
    const resource = createAudioResource(stream, {
      inputType: StreamType.Raw,
      inlineVolume: false,
      silencePaddingFrames: 0,
    });

    player.play(resource);
    console.log("Test tone started");
  } catch (error) {
    console.error("Error creating test tone:", error);
  }
}

function selectWebAPI() {
  selectNone();
  console.log("Web API selected - this would use browser audio API");
}

function selectAudioDevice(audioDevice: string) {
  selectNone();
  console.log("Audio device", audioDevice);

  // Remove the colon prefix if present for FFmpeg
  const deviceId = audioDevice.replace(':', '');
  console.log("Using device ID:", deviceId);
  
  const ffmpegArgs = [
    "-f", "avfoundation",
    "-i", `none:${deviceId}`,  // avfoundation format uses :deviceId
    "-b:a", "512k",
    "-f", "s16le",
    "-acodec", "pcm_s16le",
    "-ac", "2",
    "-ar", "48000",
    "-aq", "0",
    "-async", "1",
    "-vn",
  ];
  
  console.log("FFmpeg args:", ffmpegArgs);
  
  const stream = new FFmpeg({
    args: ffmpegArgs,
  });

  stream.on("error", (error) => {
    console.error("FFmpeg stream error:", error);
  });


  stream.on("end", () => {
    console.log("FFmpeg stream ended");
  });

  stream.on("close", () => {
    console.log("FFmpeg stream closed");
  });

  // Add a timeout to check if we're getting data
  setTimeout(() => {
    console.log("Stream state check - checking if data is flowing...");
  }, 2000);

  try {
    // Check if we have a voice connection
    if (!connection) {
      console.error("No voice connection available. Please join a voice channel first.");
      return;
    }
    
    console.log("Creating audio resource with FFmpeg stream...");
    const resource = createAudioResource(stream, {
      inputType: StreamType.Raw,
      inlineVolume: false,
      silencePaddingFrames: 5,
      
    });

    console.log("Audio resource created, starting playback...");
    player.play(resource);
    
    console.log("Audio resource created and playing started");
    
    // Check if the resource is playable
    setTimeout(() => {
      const playable = player.checkPlayable();
      console.log("Resource playable check:", playable);
    }, 1000);
    
  } catch (error) {
    console.error("Error creating audio resource:", error);
  }
}

player.on("stateChange", (oldState, newState) => {
  console.log("Player state change:", oldState.status, "->", newState.status);
  
  if (newState.status === AudioPlayerStatus.Idle) {
    console.log("Player is idle - no audio resource or playback finished");
  } else if (newState.status === AudioPlayerStatus.Playing) {
    console.log("Player is playing audio");
  } else if (newState.status === AudioPlayerStatus.Buffering) {
    console.log("Player is buffering audio");
  }
});

player.on("error", (error) => {
  console.error("Error", error);
});
async function buildTemplate(): Promise<MenuItemConstructorOptions[]> {
  const inputs: MenuItemConstructorOptions[] = [
    { label: "None", type: "radio", click: selectNone },
    { label: "Web API", type: "radio", click: selectWebAPI },
    { label: "Test Tone", type: "radio", click: testTone },
  ];

  const audioDevices = await getAudioDevices();
  console.log("Audio devices", audioDevices);

  for (const audioDevice of audioDevices) {
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
    }),
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
  

  const tray = new Tray(join(resourcesPath, "icon-3.png"));
  
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
