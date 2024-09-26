import cp from "child_process";
import ffmpegPath from "ffmpeg-static";

export function getAudioDevices() {
  const command = `${ffmpegPath} -f dshow -list_devices true -i dummy`;

  return new Promise<string[]>((resolve) => {
    cp.exec(command, (_error, _stdout, stderr) => {
      resolve(parse(stderr));
    });
  });
}

function parse(data: string) {
  const result = [];
  for (const match of data.matchAll(/"(.*)" \(audio\)/g)) {
    result.push(match[1]);
  }

  return result;
}
