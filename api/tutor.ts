import { handleTutor } from './_lib/handler.js';

export async function POST(request: Request): Promise<Response> {
  return handleTutor(request);
}
