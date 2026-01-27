import { ReactNode } from "react";
import { ShieldCheck, Wifi } from "lucide-react";

interface ExamLayoutProps {
  children: ReactNode;
  isConnected?: boolean;
  participantName?: string;
}

export function ExamLayout({ children, isConnected = true, participantName }: ExamLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      <header className="fixed top-0 left-0 right-0 h-14 border-b border-border/40 bg-background/80 backdrop-blur-md z-50 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold tracking-tight text-sm">SecureExam.OS</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
          {participantName && (
            <span className="hidden sm:inline-block px-2 py-1 bg-secondary rounded border border-border">
              {participantName}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 px-4 pb-8 max-w-2xl mx-auto w-full flex flex-col">
        {children}
      </main>

      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
    </div>
  );
}
