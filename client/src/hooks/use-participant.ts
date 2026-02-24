import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const DEVICE_ID_KEY = "exam_device_id";
const TOKEN_KEY = "exam_token";

export function useDeviceIdentity() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    let stored = localStorage.getItem(DEVICE_ID_KEY);
    if (!stored) {
      stored = uuidv4();
      localStorage.setItem(DEVICE_ID_KEY, stored);
    }
    setDeviceId(stored);
  }, []);
  return deviceId;
}

export function useIdentify() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { name: string; deviceId: string }) => {
      const res = await fetch(api.identify.path, {
        method: api.identify.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      // ✅ FIX: read the body ONCE and reuse it for both error and success paths
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.message || "Failed to identify");
      }

      return api.identify.responses[200].parse(body);
    },
    onSuccess: (data) => {
      localStorage.setItem(TOKEN_KEY, data.token);
      queryClient.invalidateQueries({ queryKey: [api.getDailyQuestion.path] });
    },
    onError: (error: Error) => {
      toast({
        title: "Identification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDailyQuestion() {
  return useQuery({
    queryKey: [api.getDailyQuestion.path],
    queryFn: async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return null; // Don't fetch if no token exists

      const res = await fetch(api.getDailyQuestion.path, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) return null; // Not identified yet

      if (!res.ok) throw new Error("Failed to fetch question");

      const data = await res.json();

      // ✅ FIX: if server returns null (no active question / already submitted),
      // skip Zod parsing — null is a valid "no question" signal
      if (data === null) return null;

      return api.getDailyQuestion.responses[200].parse(data);
    },
    retry: false,
    // Re-check every 5s for real-time updates
    refetchInterval: 5_000,
  });
}

export function useSubmitAnswer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      questionId: number;
      answerIndex: number | null;
      deviceId: string;
      reason?: string;
    }) => {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(api.submitAnswer.path, {
        method: api.submitAnswer.method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      // ✅ FIX: read body once
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.message || "Submission failed");
      }

      return api.submitAnswer.responses[200].parse(body);
    },
    onSuccess: () => {
      // Invalidate so the home page question panel switches to "All Caught Up"
      queryClient.invalidateQueries({ queryKey: [api.getDailyQuestion.path] });
      toast({
        title: "Submitted!",
        description: "Your answer has been recorded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useHeartbeat(deviceId: string | null) {
  useEffect(() => {
    if (!deviceId) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem(TOKEN_KEY);
      fetch(api.heartbeat.path, {
        method: api.heartbeat.method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deviceId }),
      }).catch(console.error);
    }, 4000);
    return () => clearInterval(interval);
  }, [deviceId]);
}
