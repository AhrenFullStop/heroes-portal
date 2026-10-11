import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../auth';
import type { VoiceTranscribeResponse } from '../../../shared/types';

export const voiceRouter = Router();

const AI_PROXY_BASE_URL =
  process.env.AI_PROXY_BASE_URL || 'https://api.staging.xgmi.com/api/proxy/v1';

const TRANSCRIBE_PROMPT =
  'Transcribe the speech in this audio. Reply with ONLY the transcript text, nothing else. If there is no speech, reply with a single space.';

function resolveAudioFormat(mime: string | undefined, bodyFormat: string | undefined): string {
  if (bodyFormat) return bodyFormat;
  if (mime) {
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('ogg')) return 'ogg';
  }
  return 'webm';
}

// OpenAI-shaped completion response -> message content, via type guards (no unchecked casts).
function extractContent(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('choices' in data)) return null;
  const choices: unknown = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first: unknown = choices[0];
  if (typeof first !== 'object' || first === null || !('message' in first)) return null;
  const message: unknown = first.message;
  if (typeof message !== 'object' || message === null || !('content' in message)) return null;
  const content: unknown = message.content;
  return typeof content === 'string' ? content : null;
}

voiceRouter.post(
  '/transcribe',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const audio = typeof req.body?.audio === 'string' ? req.body.audio : '';
      const mime = typeof req.body?.mime === 'string' ? req.body.mime : undefined;
      const bodyFormat = typeof req.body?.format === 'string' ? req.body.format : undefined;
      if (!audio) {
        res.status(400).json({ error: 'audio required' });
        return;
      }

      const key = process.env.AI_PROXY_KEY;
      if (!key) {
        res.status(502).json({ error: 'Voice service unavailable' });
        return;
      }

      const format = resolveAudioFormat(mime, bodyFormat);
      let content: string | null = null;
      try {
        const proxyRes = await fetch(`${AI_PROXY_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'gemini/gemini-2.5-flash',
            stream: false,
            max_tokens: 500,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: TRANSCRIBE_PROMPT },
                  { type: 'input_audio', input_audio: { data: audio, format } },
                ],
              },
            ],
          }),
        });
        if (proxyRes.ok) {
          content = extractContent(await proxyRes.json());
        } else {
          console.error('[voice] proxy error', proxyRes.status, await proxyRes.text().catch(() => ''));
        }
      } catch (err) {
        console.error('[voice] proxy call failed:', err);
      }

      const transcript = content !== null ? content.trim() : '';
      if (!transcript) {
        res.status(502).json({ error: 'Voice service unavailable' });
        return;
      }

      const payload: VoiceTranscribeResponse = { transcript };
      res.json(payload);
    } catch (err) {
      next(err);
    }
  }
);
