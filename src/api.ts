import { Server } from "http";
import { AudioPlayer, createAudioResource } from "@discordjs/voice";
import express, { Express, Request, Response } from "express";
import ytstream from "yt-stream";

export class API {
  private app: Express;
  private server?: Server;

  constructor(private player: AudioPlayer) {
    this.app = express();
    this.app.use(express.text());
    this.app.put("/play", this.handlePlay.bind(this));
    this.app.put("/stop", this.handleStop.bind(this));
  }

  start() {
    this.server = this.app.listen(6547, "localhost");
  }

  stop() {
    this.server?.close();
  }

  async handlePlay(req: Request, res: Response) {
    this.stream(req.body, req.query["loop"] == "true");
    res.writeHead(200);
    res.end();
  }

  async handleStop(_req: Request, res: Response) {
    this.player.stop();
    res.writeHead(200);
    res.end();
  }

  async stream(url: string, loop: boolean) {
    const source = await ytstream.stream(url, {
      quality: "high",
      type: "audio",
      highWaterMark: 1048576 * 32,
      download: true,
    });

    if (loop) {
      source.stream.on("end", () => this.stream(url, true));
    }

    const audioResource = createAudioResource(source.stream);
    this.player.play(audioResource);
  }
}
