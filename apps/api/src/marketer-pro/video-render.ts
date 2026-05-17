/**
 * ffmpeg-based video render: image slideshow → MP4.
 * Each scene image is displayed for its durationSeconds.
 * Optional MP3 audio track is mixed in.
 * Optional logoBuffer overlaid as a brand watermark (bottom-right, ~12% width).
 */

import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import type { VideoScene } from "@home-link/marketer-pro-contract";

export type RenderInput = {
  scenes: VideoScene[];
  sceneImages: Buffer[];
  audioBuffer?: Buffer;
  logoBuffer?: Buffer;
  width: number;
  height: number;
};

export type RenderResult =
  | { ok: true; buffer: Buffer; durationS: number }
  | { ok: false; error: string };

export type ThumbnailResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string };

export async function renderVideoSlideshow(input: RenderInput): Promise<RenderResult> {
  const { scenes, sceneImages, audioBuffer, logoBuffer, width, height } = input;

  if (scenes.length !== sceneImages.length) {
    return { ok: false, error: "render_scene_image_count_mismatch" };
  }

  const workDir = join(tmpdir(), `marketer-video-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });
  const outputPath = join(workDir, "output.mp4");

  try {
    const imagePaths: string[] = [];
    for (let i = 0; i < sceneImages.length; i++) {
      const imgPath = join(workDir, `scene_${i}.png`);
      await writeBuffer(sceneImages[i]!, imgPath);
      imagePaths.push(imgPath);
    }

    const audioPath = audioBuffer ? join(workDir, "audio.mp3") : null;
    if (audioBuffer && audioPath) await writeBuffer(audioBuffer, audioPath);

    const logoPath = logoBuffer ? join(workDir, "logo.png") : null;
    if (logoBuffer && logoPath) await writeBuffer(logoBuffer, logoPath);

    const totalDuration = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);

    await runFfmpeg({ imagePaths, scenes, audioPath, logoPath, outputPath, width, height });

    const buffer = await readFile(outputPath);
    return { ok: true, buffer, durationS: totalDuration };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `render_ffmpeg_error: ${msg.slice(0, 200)}` };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export async function extractThumbnail(
  videoBuffer: Buffer,
  width: number,
  height: number,
): Promise<ThumbnailResult> {
  const workDir = join(tmpdir(), `marketer-thumb-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });
  const videoPath = join(workDir, "input.mp4");
  const thumbPath = join(workDir, "thumb.jpg");

  try {
    await writeBuffer(videoBuffer, videoPath);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(0)
        .frames(1)
        .size(`${width}x${height}`)
        .output(thumbPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });
    const buffer = await readFile(thumbPath);
    return { ok: true, buffer };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `thumb_ffmpeg_error: ${msg.slice(0, 200)}` };
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
  logoPath: string | null;
  outputPath: string;
  width: number;
  height: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const { imagePaths, scenes, audioPath, logoPath, outputPath, width, height } = args;

    let cmd = ffmpeg();

    for (let i = 0; i < imagePaths.length; i++) {
      cmd = cmd.input(imagePaths[i]!).inputOptions(["-loop", "1", "-t", String(scenes[i]!.durationSeconds)]);
    }
    if (audioPath) cmd = cmd.input(audioPath);
    if (logoPath) cmd = cmd.input(logoPath);

    const sceneCount = imagePaths.length;
    const audioIndex = sceneCount;
    const logoIndex = audioPath ? sceneCount + 1 : sceneCount;

    const filterParts: string[] = [];
    for (let i = 0; i < sceneCount; i++) {
      filterParts.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
      );
    }

    const concatInputs = Array.from({ length: sceneCount }, (_, i) => `[v${i}]`).join("");
    const concatOut = logoPath ? "[concatv]" : "[outv]";
    filterParts.push(`${concatInputs}concat=n=${sceneCount}:v=1:a=0${concatOut}`);

    if (logoPath) {
      const logoW = Math.round(width * 0.12);
      filterParts.push(
        `[${logoIndex}:v]scale=${logoW}:-1[logo];` +
        `[concatv][logo]overlay=W-w-20:H-h-20:format=auto[outv]`,
      );
    }

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

    cmd
      .complexFilter(filterComplex)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}
