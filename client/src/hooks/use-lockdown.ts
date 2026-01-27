import { useEffect, useCallback } from 'react';
import { useSubmitAnswer } from './use-participant';
import { useToast } from './use-toast';

export function useLockdown(
  isEnabled: boolean,
  questionId: number | undefined,
  deviceId: string | null
) {
  const { mutate: submit } = useSubmitAnswer();
  const { toast } = useToast();

  const handleViolation = useCallback((reason: string) => {
    if (!isEnabled || !questionId || !deviceId) return;
    
    // Auto-submit on violation
    submit({
      questionId,
      answerIndex: null, // Null indicates forced submission/failure
      deviceId,
      reason
    }, {
      onSuccess: () => {
        toast({
          title: "Exam Terminated",
          description: `Security violation detected: ${reason}. Your exam has been submitted.`,
          variant: "destructive",
          duration: 10000
        });
      }
    });
  }, [isEnabled, questionId, deviceId, submit, toast]);

  useEffect(() => {
    if (!isEnabled) return;

    const onVisibilityChange = () => {
      if (document.hidden) handleViolation("Tab switch / Minimized");
    };

    const onBlur = () => {
      handleViolation("Window lost focus");
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation("Exited fullscreen");
      }
    };
    
    // Attempt fullscreen on mount
    try {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
                // User interaction required usually, ignored for now
            });
        }
    } catch(e) {
        console.error("Fullscreen blocked", e);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [isEnabled, handleViolation]);

  return { requestFullscreen: () => document.documentElement.requestFullscreen() };
}
