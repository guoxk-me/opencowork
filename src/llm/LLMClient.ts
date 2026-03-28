export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;

  complete(prompt: string): Promise<LLMResponse>;
}

export abstract class BaseLLMClient implements LLMClient {
  abstract chat(messages: LLMMessage[]): Promise<LLMResponse>;

  abstract complete(prompt: string): Promise<LLMResponse>;
}