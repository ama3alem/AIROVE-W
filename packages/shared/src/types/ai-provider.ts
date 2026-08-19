import { z } from 'zod';

export type AIProviderCapability =
  | 'TEXT_GENERATION'
  | 'CLASSIFICATION'
  | 'EMBEDDING'
  | 'STRUCTURED_OUTPUT';

export interface AIProviderConfig {
  id: string;
  name: string;
  capabilities: AIProviderCapability[];
  modelVersion: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'TESTING';
  configuration: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const aiProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  capabilities: z.array(z.enum(['TEXT_GENERATION', 'CLASSIFICATION', 'EMBEDDING', 'STRUCTURED_OUTPUT'])),
  modelVersion: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DEPRECATED', 'TESTING']),
  configuration: z.record(z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AIProvider = z.infer<typeof aiProviderSchema>;
