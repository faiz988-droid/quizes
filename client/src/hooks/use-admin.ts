import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertQuestion } from "@shared/schema";

export function useAdminStats() {
  return useQuery({
    queryKey: [api.adminStats.path],
    queryFn: async () => {
      const res = await fetch(api.adminStats.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.adminStats.responses[200].parse(await res.json());
    },
    // Refresh every 10 seconds so the live dashboard stays current
    refetchInterval: 10_000,
  });
}

export function useAdminResults(date?: string) {
  return useQuery({
    queryKey: [api.adminResults.path, date],
    queryFn: async () => {
      const url = date
        ? `${api.adminResults.path}?date=${date}`
        : api.adminResults.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch results");
      return api.adminResults.responses[200].parse(await res.json());
    },
    refetchInterval: 10_000,
  });
}

export function useAdminQuestions() {
  return useQuery({
    queryKey: [api.adminQuestions.list.path],
    queryFn: async () => {
      const res = await fetch(api.adminQuestions.list.path);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return await res.json();
    },
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertQuestion) => {
      const res = await fetch(api.adminQuestions.create.path, {
        method: api.adminQuestions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        // Surface the server's error message (e.g. "Exactly 4 options required")
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create question");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.adminQuestions.list.path],
      });
      queryClient.invalidateQueries({ queryKey: [api.adminStats.path] });
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.adminQuestions.delete.path, { id });
      const res = await fetch(url, {
        method: api.adminQuestions.delete.method,
      });

      // 204 No Content is success — do NOT try to parse the body
      if (res.status === 204) return;

      // Any other non-ok status is a real error
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete question");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.adminQuestions.list.path],
      });
      queryClient.invalidateQueries({ queryKey: [api.adminStats.path] });
    },
  });
}

export function useAdminLogin() {
  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await fetch(api.adminLogin.path, {
        method: api.adminLogin.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      return res.json();
    },
  });
}

// Resets the leaderboard (increments resetId so all old submissions are hidden)
export function useAdminReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.adminReset.path, {
        method: api.adminReset.method ?? "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Reset failed");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate everything so every widget re-fetches fresh data
      queryClient.invalidateQueries({ queryKey: [api.adminResults.path] });
      queryClient.invalidateQueries({ queryKey: [api.adminStats.path] });
      queryClient.invalidateQueries({
        queryKey: [api.adminQuestions.list.path],
      });
    },
  });
}
