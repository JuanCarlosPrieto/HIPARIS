export type AIElementProposal = {
  temp_id: string;
  type:
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
  name: string;
  x: number;
  y: number;
  confidence: number;
  notes: string;
};

export type AIEdgeProposal = {
  from_temp_id: string;
  to_temp_id: string;
  edge_type:
    | "corridor"
    | "door"
    | "ramp"
    | "elevator"
    | "stairs"
    | "manual"
    | "unknown";
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
  floorId?: string;
  realWidthMeters?: number | null;
  realHeightMeters?: number | null;
}): Promise<AIPlanProposal> {
  const apiUrl =
    process.env.NEXT_PUBLIC_AI_API_URL ?? "http://localhost:8000";

  const formData = new FormData();

  formData.append("image", params.image, "plan.jpg");

  if (params.floorId) {
    formData.append("floor_id", params.floorId);
  }

  if (params.realWidthMeters != null) {
    formData.append("real_width_meters", String(params.realWidthMeters));
  }

  if (params.realHeightMeters != null) {
    formData.append("real_height_meters", String(params.realHeightMeters));
  }

  const response = await fetch(`${apiUrl}/api/ai/analyze-plan/`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok || payload.status !== "ok") {
    throw new Error(payload.error ?? "AI analysis failed.");
  }

  return payload.proposal;
}