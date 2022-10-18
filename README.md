# Discord Audio Cable
[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)

This is an system tray app that connects to a chosen Discord voice channel and streams audio from one of your audio devices or from YouTube.

## Usage
You must create a new Discord application through the following [link](https://discord.com/developers/applications).
It needs permission to connect and speak on voice channels.
Copy your bot token and save it as `token.txt` in the same folder as the executable.
Finally, invite it to your Discord server and open the app.

To choose the audio source and Discord channel, right click the system tray icon.

## FAQ

### How do I use the YouTube API option?
Install the included Tampermonkey [script](https://raw.githubusercontent.com/vctandrade/discord-audio-cable/main/tampermonkey/discord-audio-cable.user.js).
Then open any YouTube video on your browser and use the Tampermonkey menu commands.

### How do I stream audio from a playback device?
Use [Virtual Audio Cable](https://vb-audio.com/Cable/index.htm) or [Voicemeeter](https://vb-audio.com/Voicemeeter/index.htm).