import cp from "child_process";
import ffmpegPath from "ffmpeg-static";

export function getAudioDevices() {
  const command = `${ffmpegPath} -list_devices true -f avfoundation -i dummy`;

  return new Promise<string[]>((resolve) => {
    cp.exec(command, (_error, _stdout, stderr) => {
      resolve(parse(stderr));
    });
  });
}

function parse(data: string) {
  const result = [];
  console.log("Data", data);
  for (const match of data.matchAll(/(\[\d\])/g)) {
    result.push(":"+match[0]?.split("[")[1]?.split("]")[0]);
  }

  return result;
}
