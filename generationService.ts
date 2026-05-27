export interface GenerationPayload {
  brand: string;
  audience: string;
  tone: string;
  platform: string[];
  advanced?: Record<string, any>;
}

export interface GenerationResult {
  requestId: string;
  artifacts?: any[];
  status: "pending" | "complete" | "error";
  error?: string;
}

const API_URL = "http://localhost:3001/generate"; // update for prod

export async function generateContent(
  payload: GenerationPayload
): Promise<GenerationResult> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return {
        requestId: "",
        status: "error",
        error: `Backend error: ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      requestId: data.requestId,
      status: "pending",
    };
  } catch (err: any) {
    return {
      requestId: "",
      status: "error",
      error: err.message,
    };
  }
}

export async function pollGenerationStatus(
  requestId: string
): Promise<GenerationResult> {
  try {
    const res = await fetch(`${API_URL}/status/${requestId}`);

    if (!res.ok) {
      return {
        requestId,
        status: "error",
        error: `Status error: ${res.status}`,
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      requestId,
      status: "error",
      error: err.message,
    };
  }
}
