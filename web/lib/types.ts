export type PredictResponse = {
  url: string;
  verdict: string;
  is_phishing: boolean;
  confidence: number;
  model_name: string;
  reasons: string[];
  features?: Record<string, number>;
};

export type ModelInfo = {
  model_name?: string;
  trained_at?: string;
  metrics?: Record<string, number>;
};

export type BatchRow = PredictResponse & { error?: string };