/**
 * 共享结构化抓取日志
 * 三个 fetch 工具（fetch-content / fetch-yuque / fetch-pdf）共用
 */
import { writeFileSync } from "node:fs";

export interface FetchReport {
  url: string;
  timestamp: string;
  steps: FetchStep[];
  finalMethod: string;
  success: boolean;
  quality: "empty" | "thin" | "usable" | null;
  textLength: number;
  deviation: string | null;
  errors: string[];
}

export interface FetchStep {
  name: string;
  status: "skipped" | "success" | "failed" | "fallback";
  reason?: string;
  duration?: number;
}

export class FetchLogger {
  private report: FetchReport;
  private startTime: number;

  constructor(url: string) {
    this.startTime = Date.now();
    this.report = {
      url,
      timestamp: new Date().toISOString(),
      steps: [],
      finalMethod: "",
      success: false,
      quality: null,
      textLength: 0,
      deviation: null,
      errors: [],
    };
  }

  addStep(name: string, status: FetchStep["status"], reason?: string) {
    this.report.steps.push({
      name,
      status,
      reason,
      duration: Date.now() - this.startTime,
    });
  }

  setFinalMethod(method: string) {
    this.report.finalMethod = method;
  }

  setSuccess(quality: string, textLength: number) {
    this.report.success = true;
    this.report.quality = quality as FetchReport["quality"];
    this.report.textLength = textLength;
  }

  setFailure(reason: string) {
    this.report.success = false;
    this.report.deviation = reason;
  }

  addError(error: string) {
    this.report.errors.push(error);
  }

  getReport(): FetchReport {
    return this.report;
  }

  calculateDeviation() {
    const steps = this.report.steps;

    const skillStep = steps.find((s) => s.name === "skill");
    if (skillStep?.status === "success") {
      this.report.deviation = null;
      return;
    }

    const deviations: string[] = [];

    if (skillStep?.status === "failed") {
      deviations.push(`Skill 提取失败: ${skillStep.reason}`);
    }
    if (skillStep?.status === "skipped") {
      deviations.push(`Skill 不可用: ${skillStep.reason}`);
    }

    const httpStep = steps.find((s) => s.name === "http");
    if (httpStep?.status === "failed") {
      deviations.push(`HTTP 抓取失败: ${httpStep.reason}`);
    }

    const playwrightStep = steps.find((s) => s.name === "playwright");
    if (playwrightStep?.status === "failed") {
      deviations.push(`Playwright 降级失败: ${playwrightStep.reason}`);
    }

    if (deviations.length > 0) {
      this.report.deviation = deviations.join(" → ");
    }
  }

  formatReport(): string {
    this.calculateDeviation();
    const r = this.report;
    const lines = [
      "┌─────────────────────────────────────────────────────────────",
      "│ FETCH REPORT",
      "├─────────────────────────────────────────────────────────────",
      `│ URL: ${r.url}`,
      `│ Time: ${r.timestamp}`,
      `│ Final Method: ${r.finalMethod || "unknown"}`,
      `│ Success: ${r.success ? "✅" : "❌"}`,
      `│ Quality: ${r.quality || "N/A"} | Text Length: ${r.textLength}`,
    ];

    if (r.deviation) {
      lines.push("├─────────────────────────────────────────────────────────────");
      lines.push(`│ ⚠️  DEVIATION: ${r.deviation}`);
    }

    if (r.steps.length > 0) {
      lines.push("├─────────────────────────────────────────────────────────────");
      lines.push("│ Steps:");
      for (const step of r.steps) {
        const icon = step.status === "success" ? "✅" :
                     step.status === "failed" ? "❌" :
                     step.status === "skipped" ? "⏭️" : "↩️";
        const reason = step.reason ? ` (${step.reason})` : "";
        const duration = step.duration != null ? ` [${step.duration}ms]` : "";
        lines.push(`│   ${icon} ${step.name}: ${step.status}${reason}${duration}`);
      }
    }

    if (r.errors.length > 0) {
      lines.push("├─────────────────────────────────────────────────────────────");
      lines.push("│ Errors:");
      for (const err of r.errors) {
        lines.push(`│   - ${err}`);
      }
    }

    lines.push("└─────────────────────────────────────────────────────────────");
    return lines.join("\n");
  }

  writeReportToFile(filePath: string) {
    this.calculateDeviation();
    writeFileSync(filePath, JSON.stringify(this.report, null, 2), "utf-8");
  }
}
