import * as fs from "fs";
import { join } from "path";
import { BaseEntity, DemoFile, Networkable } from "../src/index";

const root = join(__dirname, "..");

export function monitorProgress(demoName: string, demo: DemoFile) {
  const testName = expect.getState().currentTestName;

  let lastProgressTime = 0;
  demo.on("progress", frac => {
    const now = Date.now();
    if (now - lastProgressTime > 5000) {
      lastProgressTime = now;
      console.log(`[${testName}] Progress: ${(frac * 100) | 0}%`);
    }
  });

  let startTime = 0;
  demo.on("start", () => {
    startTime = Date.now();
  });

  // Some demos (such as broadcast streams) start at later ticks
  let startTick = 0;
  demo.on("tickstart", () => {
    if (startTick == 0 && demo.currentTick > 0) {
      startTick = demo.currentTick;
    }
  });

  demo.on("end", e => {
    if (startTime === 0) return;

    // Some demos do not have complete header information.
    // Treat current tick at the end of the demo (minus first non-zero tick we saw) as the total number of ticks.
    let totalTicks = demo.header.playbackTicks || demo.currentTick - startTick;

    let elapsedSecs = (Date.now() - startTime) / 1000;

    const errorText = e.error ? `\nFailed: ${e.error}` : "";

    console.log(
      `[${testName}] Parsed ${totalTicks} ticks from ${demoName} in ${elapsedSecs.toFixed(
        2
      )} secs (${(totalTicks / elapsedSecs) | 0} ticks/sec)${errorText}`
    );
  });
}

export function startParsing(demoFileName: string, demo: DemoFile) {
  const stream = fs.createReadStream(join(root, "demos", demoFileName));
  demo.parseStream(stream);
}

export function startParsingReadFull(demoFileName: string, demo: DemoFile) {
  fs.readFile(join(root, "demos", demoFileName), (err, buffer) => {
    expect(err).toBeFalsy();
    demo.parse(buffer);
  });
}

export class Timeline {
  events: string[] = [];
  demo: DemoFile;

  constructor(demo: DemoFile) {
    this.demo = demo;

    demo.on("start", () => {
      this.log("start", demo.header);
    });
    demo.on("warning", e => {
      this.log("warning", e);
    });
    demo.on("error", e => {
      this.log("error", e);
    });
    demo.on("end", e => {
      this.log("end", e);
    });
  }

  log(name: string, data: any) {
    const line = `[${this.demo.currentTick}] ${name}: ${JSON.stringify(data)}`;
    this.events[this.events.length] = line;
  }

  assertMatches() {
    expect(this.events).toMatchSnapshot("timeline");
  }
}
