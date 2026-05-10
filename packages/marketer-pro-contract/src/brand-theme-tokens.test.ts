import { describe, expect, it } from "vitest";

import {
  COLOR_SCALE_STEPS,
  CssDurationSchema,
  CssSizeSchema,
  ColorScaleSchema,
  contrastRatio,
  HexColorSchema,
  MOTION_DURATION_STEPS,
  MotionDurationScaleSchema,
  meetsContrast,
  normaliseHex,
  RADIUS_SCALE_STEPS,
  RadiusScaleSchema,
  relativeLuminance,
  SHADOW_ELEVATION_STEPS,
  ShadowScaleSchema,
  TYPE_SCALE_STEPS,
  TypeScaleSchema,
  WCAG_AA_LARGE,
  WCAG_AA_NORMAL,
  WCAG_AAA_NORMAL,
  WEIGHT_SCALE_STEPS,
  WeightScaleSchema,
} from "./brand-theme-tokens.js";

const fullColorScale = {
  "50": "#f8fafc",
  "100": "#f1f5f9",
  "200": "#e2e8f0",
  "300": "#cbd5e1",
  "400": "#94a3b8",
  "500": "#64748b",
  "600": "#475569",
  "700": "#334155",
  "800": "#1e293b",
  "900": "#0f172a",
  "950": "#020617",
};

const fullTypeScale = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
};

const fullWeightScale = {
  thin: "100",
  extralight: "200",
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
};

const fullRadiusScale = {
  none: "0px",
  sm: "2px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  "2xl": "16px",
  full: "9999px",
};

const fullShadowScale = {
  "0": "none",
  "1": "0 1px 2px rgba(0,0,0,0.05)",
  "2": "0 1px 3px rgba(0,0,0,0.1)",
  "3": "0 4px 6px rgba(0,0,0,0.1)",
  "4": "0 10px 15px rgba(0,0,0,0.1)",
  "5": "0 25px 50px rgba(0,0,0,0.25)",
};

const fullMotionScale = {
  instant: "0ms",
  fast: "100ms",
  normal: "200ms",
  slow: "300ms",
  slowest: "500ms",
};

describe("HexColorSchema", () => {
  it("accepts 3, 6, and 8 digit hex (case-insensitive)", () => {
    expect(HexColorSchema.parse("#fff")).toBe("#fff");
    expect(HexColorSchema.parse("#FFF")).toBe("#FFF");
    expect(HexColorSchema.parse("#ffffff")).toBe("#ffffff");
    expect(HexColorSchema.parse("#FFFFFF")).toBe("#FFFFFF");
    expect(HexColorSchema.parse("#ffffffff")).toBe("#ffffffff");
    expect(HexColorSchema.parse("#FFFFFFAA")).toBe("#FFFFFFAA");
  });

  it("rejects malformed hex", () => {
    expect(HexColorSchema.safeParse("fff").success).toBe(false);
    expect(HexColorSchema.safeParse("#gggggg").success).toBe(false);
    expect(HexColorSchema.safeParse("#1234").success).toBe(false);
    expect(HexColorSchema.safeParse("").success).toBe(false);
    expect(HexColorSchema.safeParse("#").success).toBe(false);
  });
});

describe("CssSizeSchema", () => {
  it("accepts px, rem, em including negative and decimal", () => {
    expect(CssSizeSchema.parse("16px")).toBe("16px");
    expect(CssSizeSchema.parse("1rem")).toBe("1rem");
    expect(CssSizeSchema.parse("1.5em")).toBe("1.5em");
    expect(CssSizeSchema.parse("0.75rem")).toBe("0.75rem");
    expect(CssSizeSchema.parse("-2px")).toBe("-2px");
  });

  it("rejects unitless / unsupported units", () => {
    expect(CssSizeSchema.safeParse("16").success).toBe(false);
    expect(CssSizeSchema.safeParse("16%").success).toBe(false);
    expect(CssSizeSchema.safeParse("16vh").success).toBe(false);
    expect(CssSizeSchema.safeParse("abc").success).toBe(false);
  });
});

describe("CssDurationSchema", () => {
  it("accepts ms and s", () => {
    expect(CssDurationSchema.parse("200ms")).toBe("200ms");
    expect(CssDurationSchema.parse("0.3s")).toBe("0.3s");
    expect(CssDurationSchema.parse("0ms")).toBe("0ms");
  });

  it("rejects bare numbers and unknown units", () => {
    expect(CssDurationSchema.safeParse("200").success).toBe(false);
    expect(CssDurationSchema.safeParse("200x").success).toBe(false);
    expect(CssDurationSchema.safeParse("ms200").success).toBe(false);
  });
});

describe("ColorScaleSchema", () => {
  it("accepts a complete scale", () => {
    expect(() => ColorScaleSchema.parse(fullColorScale)).not.toThrow();
  });

  it("rejects a scale with a missing step", () => {
    const partial = { ...fullColorScale } as Partial<typeof fullColorScale>;
    delete partial["500"];
    expect(ColorScaleSchema.safeParse(partial).success).toBe(false);
  });

  it("rejects a scale with an invalid hex value", () => {
    expect(
      ColorScaleSchema.safeParse({ ...fullColorScale, "500": "not-a-color" })
        .success,
    ).toBe(false);
  });

  it("rejects a scale with an extra key (strict)", () => {
    expect(
      ColorScaleSchema.safeParse({ ...fullColorScale, "1000": "#000000" })
        .success,
    ).toBe(false);
  });
});

describe("TypeScaleSchema", () => {
  it("accepts a complete type scale", () => {
    expect(() => TypeScaleSchema.parse(fullTypeScale)).not.toThrow();
  });

  it("rejects an unsupported size unit", () => {
    expect(
      TypeScaleSchema.safeParse({ ...fullTypeScale, base: "100%" }).success,
    ).toBe(false);
  });
});

describe("WeightScaleSchema", () => {
  it("accepts numeric weights 100..900", () => {
    expect(() => WeightScaleSchema.parse(fullWeightScale)).not.toThrow();
  });

  it("rejects out-of-range or non-numeric weights", () => {
    expect(
      WeightScaleSchema.safeParse({ ...fullWeightScale, normal: "1000" })
        .success,
    ).toBe(false);
    expect(
      WeightScaleSchema.safeParse({ ...fullWeightScale, normal: "regular" })
        .success,
    ).toBe(false);
    expect(
      WeightScaleSchema.safeParse({ ...fullWeightScale, normal: "50" }).success,
    ).toBe(false);
  });
});

describe("RadiusScaleSchema", () => {
  it("accepts a complete radius scale", () => {
    expect(() => RadiusScaleSchema.parse(fullRadiusScale)).not.toThrow();
  });
});

describe("ShadowScaleSchema", () => {
  it("accepts a complete shadow scale", () => {
    expect(() => ShadowScaleSchema.parse(fullShadowScale)).not.toThrow();
  });

  it("rejects an empty shadow value", () => {
    expect(
      ShadowScaleSchema.safeParse({ ...fullShadowScale, "0": "" }).success,
    ).toBe(false);
  });
});

describe("MotionDurationScaleSchema", () => {
  it("accepts a complete motion scale", () => {
    expect(() => MotionDurationScaleSchema.parse(fullMotionScale)).not.toThrow();
  });
});

describe("scale step constants", () => {
  it("color scale has 11 steps", () => {
    expect(COLOR_SCALE_STEPS).toHaveLength(11);
    expect(new Set(COLOR_SCALE_STEPS).size).toBe(11);
  });

  it("type scale has 10 steps", () => {
    expect(TYPE_SCALE_STEPS).toHaveLength(10);
  });

  it("weight scale has 9 steps", () => {
    expect(WEIGHT_SCALE_STEPS).toHaveLength(9);
  });

  it("radius scale has 7 steps", () => {
    expect(RADIUS_SCALE_STEPS).toHaveLength(7);
  });

  it("shadow elevation has 6 steps", () => {
    expect(SHADOW_ELEVATION_STEPS).toHaveLength(6);
  });

  it("motion duration has 5 steps", () => {
    expect(MOTION_DURATION_STEPS).toHaveLength(5);
  });
});

describe("WCAG threshold constants", () => {
  it("matches the spec", () => {
    expect(WCAG_AA_NORMAL).toBe(4.5);
    expect(WCAG_AA_LARGE).toBe(3);
    expect(WCAG_AAA_NORMAL).toBe(7);
  });
});

describe("relativeLuminance", () => {
  it("returns 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("approximates 0.2126 for pure red (per WCAG)", () => {
    expect(relativeLuminance("#ff0000")).toBeCloseTo(0.2126, 4);
  });

  it("expands short hex to the same luminance as the long form", () => {
    expect(relativeLuminance("#fff")).toBe(relativeLuminance("#ffffff"));
    expect(relativeLuminance("#000")).toBe(relativeLuminance("#000000"));
  });

  it("ignores alpha for 8-digit hex", () => {
    expect(relativeLuminance("#ffffff80")).toBe(1);
    expect(relativeLuminance("#00000080")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(relativeLuminance("#FFFFFF")).toBe(1);
    expect(relativeLuminance("#FfFfFf")).toBe(1);
  });

  it("throws on invalid hex", () => {
    expect(() => relativeLuminance("not-a-color")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("white on black equals 21 (WCAG max)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("equals 1 for the same color (no contrast)", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(contrastRatio("#abcdef", "#abcdef")).toBe(1);
  });

  it("approximates the WCAG known value for red on white (~3.998)", () => {
    expect(contrastRatio("#ff0000", "#ffffff")).toBeCloseTo(3.998, 2);
  });
});

describe("meetsContrast", () => {
  it("white-on-black passes AAA normal", () => {
    expect(meetsContrast("#ffffff", "#000000", WCAG_AAA_NORMAL)).toBe(true);
  });

  it("light-gray-on-white fails AA normal", () => {
    expect(meetsContrast("#cccccc", "#ffffff", WCAG_AA_NORMAL)).toBe(false);
  });

  it("uses AA normal as the default threshold", () => {
    expect(meetsContrast("#ffffff", "#000000")).toBe(true);
    expect(meetsContrast("#cccccc", "#ffffff")).toBe(false);
  });
});

describe("normaliseHex", () => {
  it("expands short hex and lowercases", () => {
    expect(normaliseHex("#FFF")).toBe("#ffffff");
    expect(normaliseHex("#fff")).toBe("#ffffff");
  });

  it("lowercases 6-digit hex", () => {
    expect(normaliseHex("#FFFFFF")).toBe("#ffffff");
  });

  it("preserves alpha on 8-digit hex", () => {
    expect(normaliseHex("#FFFFFFAA")).toBe("#ffffffaa");
  });

  it("throws on invalid hex", () => {
    expect(() => normaliseHex("not-a-hex")).toThrow();
  });
});
