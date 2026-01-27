import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatusCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function StatusCard({ icon, title, description, className }: StatusCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center text-center p-8 rounded-2xl bg-card border border-border shadow-sm",
        className
      )}
    >
      <div className="bg-secondary p-4 rounded-full mb-6">
        {icon}
      </div>
      <h2 className="text-xl font-bold mb-2 tracking-tight">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-balance">
        {description}
      </p>
    </motion.div>
  );
}
