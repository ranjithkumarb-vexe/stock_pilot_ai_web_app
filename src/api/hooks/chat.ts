import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { ChatHistory, ChatRequest, ChatResponse } from '../types';

export const useChatHistory = () =>
  useQuery({
    queryKey: qk.chat.history,
    queryFn: ({ signal }) => api.get<ChatHistory>(`${V1}/chat/history`, { signal }),
  });

/** POST /v1/chat. A guardrail refusal comes back as `refused: true` (HTTP 200) or as a `guardrail_blocked` error; handle both. */
export function useSendChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['chat', 'send'],
    mutationFn: (body: ChatRequest) => api.post<ChatResponse>(`${V1}/chat`, body, { timeoutMs: 120_000 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.chat.history }),
  });
}
