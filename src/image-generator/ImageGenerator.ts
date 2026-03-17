import { Resvg } from "@resvg/resvg-js";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import satori from "satori";
import { html } from "satori-html";

export interface ImageBuildConfig {
  fileName: string;
  width: number;
  height: number;
  markup: string;
}

export abstract class ImageGenerator<T> {
  protected abstract build(data: T): Promise<ImageBuildConfig>;

  public async createImage(data: T, fileName: string): Promise<string>;
  public async createImage(data: T, fileName?: string): Promise<string> {
    const config = await this.build(data);
    const outputName = fileName ?? config.fileName;

    const [fontBuffer] = await Promise.all([
      readFile(this.resolveAssetPath("fonts", "Roboto-Regular.ttf")),
      mkdir("cache", { recursive: true }),
    ]);

    const svg = await satori(html(config.markup), {
      width: config.width,
      height: config.height,
      fonts: [
        {
          name: "Roboto",
          data: fontBuffer,
          weight: 400,
          style: "normal",
        },
      ],
      loadAdditionalAsset: async (languageCode, segment) => {
        if (languageCode === 'emoji') {
          const codePoint = segment.toLowerCase()
          const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codePoint}.svg`
          const response = await fetch(url)
          const svgContent = await response.text()
          const base64Data = Buffer.from(svgContent).toString('base64')
          return `data:image/svg+xml;base64,${base64Data}`
        }
        return ''
      }
    });

    const pngBuffer = new Resvg(svg).render().asPng();
    await writeFile(join("cache", outputName), pngBuffer);

    return outputName;
  }

  protected async loadTemplate(fileName: string): Promise<string> {
    const templatePath = this.resolveAssetPath("templates", fileName);
    return readFile(templatePath, "utf8");
  }

  private resolveAssetPath(folder: string, fileName: string): string {
    const candidates = [
      join(__dirname, folder, fileName),
      join(process.cwd(), "src", "image-generator", folder, fileName),
      join(process.cwd(), "dist", "image-generator", folder, fileName),
    ];

    const existing = candidates.find((path) => existsSync(path));
    if (!existing) {
      throw new Error(`Missing asset "${fileName}" in "${folder}"`);
    }

    return existing;
  }
}
