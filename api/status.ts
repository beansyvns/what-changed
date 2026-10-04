import { handleStatus } from './_lib/handler.js';

export async function GET(): Promise<Response> {
  return handleStatus();
}
