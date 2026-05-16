/**
 * ffmpeg-based video render: image slideshow → MP4.
 * Each scene image is displayed for its durationSeconds.
 * Optional MP3 audio track is mixed in.
 */

import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import type { VideoScene } from "@home-link/marketer-pro-contract";

export type RenderInput = {
  scenes: VideoScene[];
  sceneImages: Buffer[];   // one PNG per scene, same order
  audioBuffer?: Buffer;    // optional MP3 voiceover
  width: number;
  height: number;
};

export type RenderResult =
  | { ok: true; buffer: Buffer; durationS: number }
  | { ok: false; error: string };

export async function renderVideoSlideshow(input: RenderInput): Promise<RenderResult> {
  const { scenes, sceneImages, audioBuffer, width, height } = input;

  if (scenes.length !== sceneImages.length) {
    return { ok: false, error: "render_scene_image_count_mismatch" };
  }

  const workDir = join(tmpdir(), `marketer-video-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });

  const outputPath = join(workDir, "output.mp4");

  try {
    // Write scene images to temp files
    const imagePaths: string[] = [];
    for (let i = 0; i < sceneImages.length; i++) {
      const imgPath = join(workDir, `scene_${i}.png`);
      await writeBuffer(sceneImages[i]!, imgPath);
      imagePaths.push(imgPath);
    }

    // Write audio if provided
    const audioPath = audioBuffer ? join(workDir, "audio.mp3") : null;
    if (audioBuffer && audioPath) {
      await writeBuffer(audioBuffer, audioPath);
    }

    const totalDuration = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);

    await runFfmpeg({ imagePaths, scenes, audioPath, outputPath, width, height });

    const { readFile } = await import("node:fs/promises");
    const buffer = await readFile(outputPath);

    return { ok: true, buffer, durationS: totalDuration };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `render_ffmpeg_error: ${msg.slice(0, 200)}` };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function writeBuffer(buf: Buffer, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(path);
    stream.on("finish", resolve);
    stream.on("error", reject);
    stream.end(buf);
  });
}

function runFfmpeg(args: {
  imagePaths: string[];
  scenes: VideoScene[];
  audioPath: string | null;
  outputPath: string;
  width: number;
  height: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const { imagePaths, scenes, audioPath, outputPath, width, height } = args;

    // Build concat demuxer input list
    const concatLines = imagePaths.map((p, i) =>
      `file '${p.replace(/'/g, "'\\''")}'\nduration ${scenes[i]!.durationSeconds}`
    ).join("\n");

    // Write concat file inline via pipe isn't easy with fluent-ffmpeg;
    // use -loop + -t per image via complex filter instead
    let cmd = ffmpeg();

    for (let i = 0; i < imagePaths.length; i++) {
      cmd = cmd.input(imagePaths[i]!).inputOptions(["-loop", "1", "-t", String(scenes[i]!.durationSeconds)]);
    }

    if (audioPath) {
      cmd = cmd.input(audioPath);
    }

    const sceneCount = imagePaths.length;
    const audioIndex = sceneCount; // audio input index

    // Build filter_complex: scale each image, then concat
    const filterParts: string[] = [];
    for (let i = 0; i < sceneCount; i++) {
      filterParts.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
      );
    }
    const concatInputs = Array.from({ length: sceneCount }, (_, i) => `[v${i}]`).join("");
    filterParts.push(`${concatInputs}concat=n=${sceneCount}:v=1:a=0[outv]`);

    const filterComplex = filterParts.join(";");

    const outputOptions = [
      "-map", "[outv]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
    ];

    if (audioPath) {
      outputOptions.push("-map", `${audioIndex}:a`, "-c:a", "aac", "-shortest");
    }

    void concatLines; // used only for documentation

    cmd
      .complexFilter(filterComplex)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}
