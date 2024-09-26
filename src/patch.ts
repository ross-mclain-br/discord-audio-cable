import Module from "module";

function wrap(object: any, method: string, wrapFunc: (original: any) => any) {
  const original = object[method];
  object[method] = wrapFunc(original);
}

wrap(Module, "_load", (original: (...args: any) => string) => {
  return (request: string, ...args: any) => {
    let result = original.apply(Module, [request, ...args]);

    if (request === "ffmpeg-static") {
      result = result.replace("app.asar", "app.asar.unpacked");
    }

    return result;
  };
});
