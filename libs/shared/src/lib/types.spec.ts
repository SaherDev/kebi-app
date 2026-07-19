import { CONSULT_TOOLS, isConsultTool, RESEARCH_TOOL } from "./types";

describe("isConsultTool", () => {
  it("accepts exactly the consult-family tool names", () => {
    for (const tool of CONSULT_TOOLS) expect(isConsultTool(tool)).toBe(true);
  });

  it("rejects research, unknown/future tools, and null (ADR-050/ADR-019)", () => {
    expect(isConsultTool(RESEARCH_TOOL)).toBe(false);
    expect(isConsultTool("future_tool")).toBe(false);
    expect(isConsultTool(null)).toBe(false);
    expect(isConsultTool("")).toBe(false);
  });
});
