import { useState } from "react";
import {
  useDeviceIdentity,
  useIdentify,
  useDailyQuestion,
  useHeartbeat,
  useSubmitAnswer,
} from "@/hooks/use-participant";

import { ExamLayout } from "@/components/layout/ExamLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { StatusCard } from "@/components/ui/StatusCard";

import {
  Loader2,
  ArrowRight,
  Lock,
  CheckCircle2,
  Send,
  AlertOctagon,
  MonitorX,
} from "lucide-react";

import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { identifySchema } from "@shared/schema";
import { useLockdown } from "@/hooks/use-lockdown";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────────── */

interface Question {
  id: number;
  content: string;
  options: string[];
  order: number;
  quizDate: string;
}

interface ApiError {
  status?: number;
  message?: string;
}

/* ────────────────────────────────────────────────────────────────
   Identification Form
──────────────────────────────────────────────────────────────── */

function IdentificationForm({
  deviceId,
  onSuccess,
}: {
  deviceId: string;
  onSuccess: () => void;
}) {
  const { mutate, isPending } = useIdentify();

  const form = useForm<{ name: string }>({
    resolver: zodResolver(identifySchema.pick({ name: true })),
    defaultValues: { name: "" },
  });

  const onSubmit = (data: { name: string }) => {
    mutate({ name: data.name.trim(), deviceId }, { onSuccess });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mx-auto"
    >
      <Card className="p-6 border-border/60 shadow-lg">
        <div className="mb-6 text-center space-y-2">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Identity Check</h1>
          <p className="text-sm text-muted-foreground">
            Enter your full name to bind this device.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input
            placeholder="Full Name"
            {...form.register("name")}
            className="h-11 bg-muted/50"
          />

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 font-semibold"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Device: <span className="font-mono">{deviceId.slice(0, 8)}...</span>
          </p>
        </form>
      </Card>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Security Gate
──────────────────────────────────────────────────────────────── */

function SecurityGate({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto text-center space-y-8">
      <div className="space-y-4">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertOctagon className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold">Security Check</h1>
        <p className="text-muted-foreground">
          Leaving fullscreen or switching tabs triggers automatic submission.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full text-sm">
        <div className="p-4 bg-muted/50 rounded-lg border">
          <MonitorX className="w-5 h-5 mb-2 text-primary" />
          <span className="font-semibold block">Fullscreen Required</span>
          <span className="text-xs text-muted-foreground">
            Must remain active
          </span>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg border">
          <AlertOctagon className="w-5 h-5 mb-2 text-primary" />
          <span className="font-semibold block">Focus Monitoring</span>
          <span className="text-xs text-muted-foreground">
            Tab switches logged
          </span>
        </div>
      </div>

      <Button size="lg" className="w-full h-14" onClick={onBegin}>
        Begin Exam
      </Button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Question Panel
──────────────────────────────────────────────────────────────── */

function QuestionPanel({
  question,
  deviceId,
}: {
  question: Question;
  deviceId: string;
}) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const { mutate: submitAnswer, isPending } = useSubmitAnswer();
  const { requestFullscreen } = useLockdown(hasStarted, question.id, deviceId);

  const handleBegin = () => {
    requestFullscreen();
    setHasStarted(true);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;

    submitAnswer(
      {
        questionId: question.id,
        answerIndex: selectedOption,
        deviceId,
      },
      { onSuccess: () => setSubmitted(true) },
    );
  };

  if (submitted) {
    return (
      <div className="flex-1 flex justify-center items-center max-w-md mx-auto">
        <StatusCard
          icon={<CheckCircle2 className="w-8 h-8 text-green-600" />}
          title="Answer Submitted"
          description="Your response has been recorded."
        />
      </div>
    );
  }

  if (!hasStarted) {
    return <SecurityGate onBegin={handleBegin} />;
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto w-full">
      <div>
        <span className="text-xs font-mono text-primary uppercase">
          Question #{question.order} · {question.quizDate}
        </span>
        <h2 className="text-2xl font-bold mt-2">{question.content}</h2>
      </div>

      <RadioGroup
        onValueChange={(value) => setSelectedOption(Number(value))}
        className="space-y-4"
      >
        {question.options.map((opt, idx) => (
          <div key={idx}>
            <RadioGroupItem
              value={idx.toString()}
              id={`opt-${idx}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`opt-${idx}`}
              className={cn(
                "flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all",
                "hover:bg-muted/50",
                selectedOption === idx && "border-primary bg-primary/5",
              )}
            >
              <span className="mr-4 font-mono font-bold">
                {String.fromCharCode(65 + idx)}
              </span>
              {opt}
            </Label>
          </div>
        ))}
      </RadioGroup>

      <Button
        onClick={handleSubmit}
        disabled={selectedOption === null || isPending}
        className="w-full h-14 text-lg font-bold"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            Submit Answer
            <Send className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Main Page
──────────────────────────────────────────────────────────────── */

export default function Home() {
  const deviceId = useDeviceIdentity();
  const { data, isLoading, error } = useDailyQuestion();
  useHeartbeat(deviceId);

  if (!deviceId || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const apiError = error as ApiError | undefined;

  if ((data === null && apiError?.status === 403) || apiError?.status === 403) {
    return (
      <ExamLayout isConnected>
        <IdentificationForm
          deviceId={deviceId}
          onSuccess={() => window.location.reload()}
        />
      </ExamLayout>
    );
  }

  if (!data) {
    return (
      <ExamLayout isConnected>
        <div className="flex justify-center items-center flex-1">
          <StatusCard
            icon={<CheckCircle2 className="w-8 h-8 text-green-600" />}
            title="No Active Question"
            description="You have completed today's exam or none is scheduled."
          />
        </div>
      </ExamLayout>
    );
  }

  return (
    <ExamLayout isConnected>
      <QuestionPanel question={data as Question} deviceId={deviceId} />
    </ExamLayout>
  );
}
