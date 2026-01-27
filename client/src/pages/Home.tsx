import { useState } from "react";
import { useDeviceIdentity, useIdentify, useDailyQuestion, useHeartbeat } from "@/hooks/use-participant";
import { ExamLayout } from "@/components/layout/ExamLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRight, Lock, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { identifySchema } from "@shared/schema";
import { StatusCard } from "@/components/ui/StatusCard";

// Identification Form Component
function IdentificationForm({ deviceId, onSuccess }: { deviceId: string, onSuccess: () => void }) {
  const { mutate, isPending } = useIdentify();
  
  const form = useForm({
    resolver: zodResolver(identifySchema.pick({ name: true })),
    defaultValues: { name: "" }
  });

  const onSubmit = (data: { name: string }) => {
    mutate({ name: data.name, deviceId }, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mx-auto"
    >
      <Card className="p-6 border-border/60 shadow-lg">
        <div className="mb-6 space-y-2 text-center">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Identity Check</h1>
          <p className="text-sm text-muted-foreground">
            Enter your full name to begin. This will be bound to your device ID.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} className="h-11 bg-muted/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full h-11 font-semibold text-base transition-all active:scale-[0.98]" 
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                <>Continue to Exam <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Device ID: <span className="font-mono">{deviceId.slice(0, 8)}...</span>
            </p>
          </form>
        </Form>
      </Card>
    </motion.div>
  );
}

export default function Home() {
  const deviceId = useDeviceIdentity();
  const [, setLocation] = useLocation();
  const { data: questionData, isLoading, error } = useDailyQuestion();
  
  // Start heartbeat
  useHeartbeat(deviceId);

  if (!deviceId || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // If fetching returned 403 (handled in hook as null), user needs to identify
  if (questionData === null) {
    return (
      <ExamLayout isConnected={true}>
        <div className="flex-1 flex flex-col justify-center">
          <IdentificationForm deviceId={deviceId} onSuccess={() => window.location.reload()} />
        </div>
      </ExamLayout>
    );
  }

  // If user is identified but no question is available (or already submitted)
  // The API returns null for "no question" in a real scenario, but let's assume 
  // the hook handles the payload. If payload is null but status was 200, it means no question.
  if (!questionData) {
    return (
      <ExamLayout isConnected={true}>
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
           <StatusCard 
             icon={<CheckCircle2 className="w-8 h-8 text-green-600" />}
             title="All Caught Up"
             description="You have completed the daily challenge or no question is active right now. Check back later."
           />
        </div>
      </ExamLayout>
    );
  }

  // If question exists, redirect to exam page
  if (questionData) {
    setLocation("/exam");
    return null;
  }

  return null;
}
