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
  });
}

export function useAdminQuestions() {
  return useQuery({
    queryKey: [api.adminQuestions.list.path],
    queryFn: async () => {
      const res = await fetch(api.adminQuestions.list.path);
      if (!res.ok) throw new Error("Failed to fetch questions");
      // Schema is generic in routes for list, but we know shape
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
      if (!res.ok) throw new Error("Failed to create question");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.adminQuestions.list.path] }),
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.adminQuestions.delete.path, { id });
      const res = await fetch(url, { method: api.adminQuestions.delete.method });
      if (!res.ok) throw new Error("Failed to delete question");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.adminQuestions.list.path] }),
  });
}

export function useAdminLogin() {
  return useMutation({
    mutationFn: async (credentials: any) => {
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
