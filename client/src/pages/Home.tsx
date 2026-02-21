import { useState } from "react";
import { useDeviceIdentity, useIdentify, useDailyQuestion, useHeartbeat, useSubmitAnswer } from "@/hooks/use-participant";
import { ExamLayout } from "@/components/layout/ExamLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, Lock, CheckCircle2, Send, AlertOctagon, MonitorX } from "lucide-react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { identifySchema } from "@shared/schema";
import { StatusCard } from "@/components/ui/StatusCard";
import { useLockdown } from "@/hooks/use-lockdown";
import { cn } from "@/lib/utils";

// ─── Identification Form ────────────────────────────────────────────────────

function IdentificationForm({ deviceId, onSuccess }: { deviceId: string; onSuccess: () => void }) {
  const { mutate, isPending } = useIdentify();

  const form = useForm({
    resolver: zodResolver(identifySchema.pick({ name: true })),
    defaultValues: { name: "" },
  });

  const onSubmit = (data: { name: string }) => {
    mutate({ name: data.name, deviceId }, { onSuccess: () => onSuccess() });
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

// ─── Security Gate ───────────────────────────────────────────────────────────

function SecurityGate({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto w-full text-center space-y-8">
      <div className="space-y-4">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertOctagon className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Security Check</h1>
        <p className="text-muted-foreground text-balance">
          This exam is monitored. Switching tabs, minimizing the window, or exiting fullscreen will result in
          <strong> immediate submission</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full text-left text-sm">
        <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
          <MonitorX className="w-5 h-5 mb-2 text-primary" />
          <span className="font-semibold block">Fullscreen Mode</span>
          <span className="text-muted-foreground text-xs">Required throughout</span>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
          <AlertOctagon className="w-5 h-5 mb-2 text-primary" />
          <span className="font-semibold block">Focus Tracking</span>
          <span className="text-muted-foreground text-xs">Tab switches flagged</span>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full text-lg h-14 shadow-lg shadow-primary/20"
        onClick={onBegin}
      >
        I Understand, Begin Exam
      </Button>
    </div>
  );
}

// ─── Question Panel ───────────────────────────────────────────────────────────

function QuestionPanel({ question, deviceId }: { question: any; deviceId: string }) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { mutate: submit, isPending: isSubmitting } = useSubmitAnswer();
  const [hasStarted, setHasStarted] = useState(false);

  // Activate lockdown only after the participant clicks "Begin"
  const { requestFullscreen } = useLockdown(hasStarted, question?.id, deviceId);

  const handleBegin = () => {
    requestFullscreen();
    setHasStarted(true);
  };

  const handleSubmit = () => {
    if (!question || !deviceId || selectedOption === null) return;
    submit(
      {
        questionId: question.id,
        answerIndex: parseInt(selectedOption),
        deviceId,
      },
      {
        onSuccess: () => setSubmitted(true),
      }
    );
  };

  // Show submission success
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <StatusCard
          icon={<CheckCircle2 className="w-8 h-8 text-green-600" />}
          title="Answer Submitted!"
          description="Your answer has been recorded successfully. Results will be shown after all participants complete the exam."
        />
      </div>
    );
  }

  // Show security gate before starting
  if (!hasStarted) {
    return <SecurityGate onBegin={handleBegin} />;
  }

  const options = question.options as string[];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto w-full">
      {/* Question Header */}
      <div className="space-y-2">
        <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
          Daily Question #{question.order} · {question.quizDate}
        </span>
        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{question.content}</h2>
      </div>

      {/* Options */}
      <RadioGroup onValueChange={setSelectedOption} className="space-y-4">
        {options.map((opt: string, idx: number) => (
          <div key={idx} className="relative group">
            <RadioGroupItem
              value={idx.toString()}
              id={`opt-${idx}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`opt-${idx}`}
              className={cn(
                "flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200",
                "hover:bg-muted/50 hover:border-primary/50",
                "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-sm"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 border-muted-foreground/30 mr-4 text-sm font-bold font-mono transition-colors shrink-0",
                  selectedOption === idx.toString() &&
                    "border-primary bg-primary text-primary-foreground"
                )}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="text-lg font-medium">{opt}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>

      {/* Submit Button */}
      <div className="pt-4">
        <Button
          onClick={handleSubmit}
          disabled={selectedOption === null || isSubmitting}
          className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20 disabled:shadow-none"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...</>
          ) : (
            <>Submit Final Answer <Send className="ml-2 h-5 w-5" /></>
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-3">
          Once submitted, your answer cannot be changed.
        </p>
      </div>
    </div>
  );
}

// ─── Main Home Page ───────────────────────────────────────────────────────────

export default function Home() {
  const deviceId = useDeviceIdentity();
  const { data: questionData, isLoading, error } = useDailyQuestion();

  // Keep participant heartbeat active
  useHeartbeat(deviceId);

  // ── Loading state ──
  if (!deviceId || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // ── 403 → participant not yet identified ──
  if (questionData === null && (error as any)?.status === 403) {
    return (
      <ExamLayout isConnected={true}>
        <div className="flex-1 flex flex-col justify-center">
          <IdentificationForm
            deviceId={deviceId}
            onSuccess={() => window.location.reload()}
          />
        </div>
      </ExamLayout>
    );
  }

  // ── No active question (already submitted or none scheduled) ──
  if (!questionData) {
    // If the error indicates not identified yet (no auth header), show identification
    if (error) {
      return (
        <ExamLayout isConnected={true}>
          <div className="flex-1 flex flex-col justify-center">
            <IdentificationForm
              deviceId={deviceId}
              onSuccess={() => window.location.reload()}
            />
          </div>
        </ExamLayout>
      );
    }

    return (
      <ExamLayout isConnected={true}>
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <StatusCard
            icon={<CheckCircle2 className="w-8 h-8 text-green-600" />}
            title="All Caught Up"
            description="You have completed today's challenge, or no question is scheduled right now. Check back later."
          />
        </div>
      </ExamLayout>
    );
  }

  // ── Active question → show inline exam ──
  return (
    <ExamLayout isConnected={true}>
      <QuestionPanel question={questionData} deviceId={deviceId} />
    </ExamLayout>
  );
}