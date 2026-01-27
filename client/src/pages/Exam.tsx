import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ExamLayout } from "@/components/layout/ExamLayout";
import { useDailyQuestion, useSubmitAnswer, useDeviceIdentity, useHeartbeat } from "@/hooks/use-participant";
import { useLockdown } from "@/hooks/use-lockdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Send, AlertOctagon, MonitorX } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Exam() {
  const [, setLocation] = useLocation();
  const deviceId = useDeviceIdentity();
  const { data: question, isLoading } = useDailyQuestion();
  const { mutate: submit, isPending: isSubmitting } = useSubmitAnswer();
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Heartbeat active
  useHeartbeat(deviceId);

  // Lockdown active ONLY after starting
  const { requestFullscreen } = useLockdown(hasStarted, question?.id, deviceId);

  const handleSubmit = () => {
    if (!question || !deviceId || selectedOption === null) return;
    
    submit({
      questionId: question.id,
      answerIndex: parseInt(selectedOption),
      deviceId
    }, {
      onSuccess: () => {
        setLocation("/");
      }
    });
  };

  const startExam = () => {
    requestFullscreen();
    setHasStarted(true);
  };

  if (isLoading || !question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <ExamLayout>
        <div className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto w-full text-center space-y-8">
          <div className="space-y-4">
             <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertOctagon className="w-10 h-10" />
             </div>
             <h1 className="text-3xl font-bold tracking-tight">Security Check</h1>
             <p className="text-muted-foreground text-balance">
               This exam is monitored. Switching tabs, minimizing the window, or exiting fullscreen will result in 
               <strong> immediate termination</strong>.
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
            onClick={startExam}
          >
            I Understand, Begin Exam
          </Button>
        </div>
      </ExamLayout>
    );
  }

  // Parse options - API says string[] but schema mentioned it could be complex. Assuming string[] for now based on routes.ts
  const options = question.options as string[];

  return (
    <ExamLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
            Daily Question #{question.order}
          </span>
          <h2 className="text-2xl md:text-3xl font-bold leading-tight">
            {question.content}
          </h2>
        </div>

        <RadioGroup onValueChange={setSelectedOption} className="space-y-4">
          {options.map((opt, idx) => (
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
                <span className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 border-muted-foreground/30 mr-4 text-sm font-bold font-mono transition-colors",
                  "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                )}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-lg font-medium">{opt}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="pt-8">
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
        </div>
      </div>
    </ExamLayout>
  );
}
