import { AsyncLocalStorage } from "node:async_hooks";
import { accountByRequest, readAiCredentials, type AiCredentials } from "./secure-db";

export const aiCredentialsContext = new AsyncLocalStorage<AiCredentials | null>();

/** Request-local, including nested async calls. Never mutate process.env with a user's key. */
export function withAiCredentials(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const account = accountByRequest(req);
    const credentials = account ? readAiCredentials(account.id) : null;
    return aiCredentialsContext.run(credentials, () => handler(req));
  };
}

export function aiKey(provider: AiCredentials["provider"]): string | undefined {
  const credentials = aiCredentialsContext.getStore();
  // A saved account configuration replaces global credentials, including speech credentials.
  if (credentials) return credentials.provider === provider ? credentials.apiKey : undefined;
  return provider === "glm" ? process.env.GLM_API_KEY : process.env.ANTHROPIC_API_KEY;
}
