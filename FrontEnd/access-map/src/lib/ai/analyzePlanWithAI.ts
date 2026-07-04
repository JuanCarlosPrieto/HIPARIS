export type AIElementType =
  | "entrance"
  | "elevator"
  | "stairs"
  | "ramp"
  | "door"
  | "room"
  | "corridor"
  | "toilet"
  | "accessible_toilet"
  | "obstacle"
  | "unknown";

export type AIEdgeType =
  | "corridor"
  | "door"
  | "ramp"
  | "elevator"
  | "stairs"
  | "manual"
  | "unknown";

export type AIElementProposal = {
  temp_id: string;
  type: AIElementType;
  name: string;
  x: number;
  y: number;
  confidence: number;
  notes: string;
};

export type AIEdgeProposal = {
  from_temp_id: string;
  to_temp_id: string;
  edge_type: AIEdgeType;
  confidence: number;
  wheelchair_accessible: boolean | null;
  crutches_accessible: boolean | null;
  notes: string;
};

export type AIPlanProposal = {
  elements: AIElementProposal[];
  edges: AIEdgeProposal[];
  warnings: string[];
};

export async function analyzePlanWithAI(params: {
  image: Blob;
  floorId: string;
  realWidthMeters?: number | null;
  realHeightMeters?: number | null;
}): Promise<AIPlanProposal> {
  const apiUrl =
    process.env.NEXT_PUBLIC_AI_API_URL ?? "http://localhost:8000";

  const formData = new FormData();

  formData.append("image", params.image, "plan.jpg");
  formData.append("floor_id", params.floorId);

  if (params.realWidthMeters !== null && params.realWidthMeters !== undefined) {
    formData.append("real_width_meters", String(params.realWidthMeters));
  }

  if (params.realHeightMeters !== null && params.realHeightMeters !== undefined) {
    formData.append("real_height_meters", String(params.realHeightMeters));
  }

  const response = await fetch(`${apiUrl}/api/ai/analyze-plan/`, {
    method: "POST",
    body: formData,
  });

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error("Réponse invalide du microservice IA.");
  }

  if (!response.ok) {
    const error =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Erreur pendant l'analyse IA.";

    throw new Error(error);
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("status" in payload) ||
    payload.status !== "ok" ||
    !("proposal" in payload)
  ) {
    throw new Error("Format de réponse IA invalide.");
  }

  return payload.proposal as AIPlanProposal;
}