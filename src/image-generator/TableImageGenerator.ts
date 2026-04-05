import { TopTableData } from "@/discord/types";
import { ImageBuildConfig, ImageGenerator } from "@/image-generator";

export class TableImageGenerator extends ImageGenerator<TopTableData> {
  protected async build(data: TopTableData): Promise<ImageBuildConfig> {
    const rowHeight = 50;
    
    // Outer padding: 20 (10px top/bottom)
    // Header height: 60
    // Footer height: 60
    const canvasHeight = 20 + 60 + 60 + (rowHeight * data.rows.length);
    const template = await this.loadTemplate("top-table.html");

    const rowsHtml = data.rows
      .map((row, index) => {
        let rankColor = "#949ba4";
        let rankSize = "16px";
        
        if (row.rank === 1) {
          rankColor = "#f1c40f"; // Gold
          rankSize = "20px";
        } else if (row.rank === 2) {
          rankColor = "#bcc6cc"; // Silver
          rankSize = "18px";
        } else if (row.rank === 3) {
          rankColor = "#cd7f32"; // Bronze
          rankSize = "18px";
        }

        const rowBg = index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)";

        return `
      <div style="display: flex; height: ${rowHeight}px; align-items: center; background-color: ${rowBg}; color: #dbdee1; font-size: 16px;">
        <div style="display: flex; width: 80px; justify-content: center; font-weight: 800; color: ${rankColor}; font-size: ${rankSize};">
          ${row.rank}
        </div>
        <div style="display: flex; width: 350px; padding-left: 20px; font-weight: 600; align-items: center; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; color: white;">
          ${escapeHtml(row.pseudo)}
        </div>
        <div style="display: flex; width: 180px; justify-content: flex-end; color: #23a559; font-weight: 600;">
          ${escapeHtml(row.vocal)}
        </div>
        <div style="display: flex; width: 180px; justify-content: flex-end; color: #00a8fc; font-weight: 600; padding-right: 30px;">
          ${row.message}
        </div>
      </div>
    `;
      })
      .join("");

    const markup = template
      .replace("{{canvasHeight}}", String(canvasHeight))
      .replaceAll("{{rowHeight}}", String(rowHeight))
      .replace("{{rowsHtml}}", rowsHtml)
      .replace("{{totalVocal}}", escapeHtml(data.totalVocal))
      .replace("{{totalMessages}}", data.totalMessages.toString());

    return {
      fileName: "table-stats.png",
      width: 850,
      height: canvasHeight,
      markup,
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
