import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: RequestInit
): Promise<Response> {
  const headers: HeadersInit = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers || {})
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    ...(options ? { ...options, headers: undefined } : {}),
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
type QueryFnOptions = {
  on401: UnauthorizedBehavior;
  headers?: HeadersInit;
};

export const getQueryFn: <T>(options: QueryFnOptions) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, headers }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: headers || {},
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 10000, // 10 seconds
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
