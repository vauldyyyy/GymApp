import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function route(operation: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next: NextFunction) => { void operation(req, res).catch(next); };
}
export function record(value: unknown, label = 'Request body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'invalid_input', `${label} must be a JSON object.`);
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new ApiError(400, 'invalid_input', `${label} must contain ${min}–${max} characters.`);
  }
  return value.trim();
}
export function email(value: unknown): string {
  const normalized = text(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new ApiError(400, 'invalid_input', 'Enter a valid email address.');
  return normalized;
}
export function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 256) {
    throw new ApiError(400, 'invalid_input', 'Password must contain 8–256 characters.');
  }
  return value;
}
