import { useState } from "react";
import {
  useAdminLogin,
  useAdminStats,
  useAdminResults,
  useCreateQuestion,
  useAdminQuestions,
  useDeleteQuestion,
  useAdminReset,
} from "@/hooks/use-admin";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Trash2,
  Download,
  LogOut,
  Users,
  CheckCircle,
  HelpCircle,
  RefreshCcw,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: any;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const { mutate, isPending } = useAdminLogin();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      { username: user, password: pass },
      {
        onSuccess: () => {
          localStorage.setItem("admin_auth", "true");
          onLogin();
        },
        onError: () =>
          toast({
            title: "Login Failed",
            description: "Invalid credentials",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Admin Portal</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={user} onChange={(e) => setUser(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : "Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// ─── Schedule Badge ───────────────────────────────────────────────────────────

type ScheduleBadgeProps = {
  quizDate: string;
  scheduledTime?: string | null;
};

function ScheduleBadge({ quizDate, scheduledTime }: ScheduleBadgeProps) {
  const baseClasses =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap";

  const immediateClasses =
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";

  const pendingClasses =
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";

  if (!scheduledTime) {
    return (
      <span className={`${baseClasses} ${immediateClasses}`}>
        <Clock className="w-3 h-3" />
        Immediate
      </span>
    );
  }

  const scheduledAt = new Date(`${quizDate}T${scheduledTime}`);
  const now = new Date();
  const isPending = !isNaN(scheduledAt.getTime()) && scheduledAt > now;

  return (
    <span
      className={`${baseClasses} ${
        isPending ? pendingClasses : immediateClasses
      }`}
    >
      <Clock className="w-3 h-3" />
      {scheduledTime}
      {isPending && " ⏳"}
    </span>
  );
}
// ─── Create Question Dialog ───────────────────────────────────────────────────

function CreateQuestionDialog() {
  const { mutate, isPending } = useCreateQuestion();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      content: "",
      options: "",
      correctAnswerIndex: "0",
      order: "1",
      quizDate: format(new Date(), "yyyy-MM-dd"),
      scheduledTime: format(new Date(), "HH:mm"), // default to current time
    },
  });

  const onSubmit = (data: any) => {
    const parsedOptions = data.options
      .split("\n")
      .map((o: string) => o.trim())
      .filter(Boolean);

    if (parsedOptions.length !== 4) {
      toast({
        title: "Validation Error",
        description: "Enter exactly 4 options, one per line.",
        variant: "destructive",
      });
      return;
    }

    const correctIndex = parseInt(data.correctAnswerIndex);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      toast({
        title: "Validation Error",
        description: "Correct index must be 0–3.",
        variant: "destructive",
      });
      return;
    }

    mutate(
      {
        content: data.content.trim(),
        options: parsedOptions,
        correctAnswerIndex: correctIndex,
        order: parseInt(data.order) || 1,
        quizDate: data.quizDate,
        scheduledTime: data.scheduledTime || "",
        isActive: true,
      },
      {
        onSuccess: () => {
          toast({
            title: "Question Scheduled",
            description: `Active on ${data.quizDate} at ${data.scheduledTime}`,
          });
          setOpen(false);
          reset();
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message || "Failed to create question.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" /> Add Question
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule a Question</DialogTitle>
          <DialogDescription>
            The question will become visible to participants only on the chosen
            date and after the scheduled time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Date + Time side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quiz Date</Label>
              <Input
                type="date"
                {...register("quizDate", { required: true })}
              />
              {errors.quizDate && (
                <p className="text-xs text-destructive">Required</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                Scheduled Time
              </Label>
              <Input type="time" {...register("scheduledTime")} />
              <p className="text-xs text-muted-foreground">
                24h · server local time (Leave empty for immediate)
              </p>
            </div>
          </div>

          {/* Question Content */}
          <div className="space-y-2">
            <Label>Question Content</Label>
            <Textarea
              {...register("content", { required: true })}
              placeholder="What is the capital of France?"
              rows={3}
            />
            {errors.content && (
              <p className="text-xs text-destructive">Content is required</p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label>
              Options{" "}
              <span className="text-muted-foreground text-xs">
                (exactly 4, one per line)
              </span>
            </Label>
            <Textarea
              {...register("options", { required: true })}
              placeholder={"London\nBerlin\nParis\nMadrid"}
              rows={4}
            />
            {errors.options && (
              <p className="text-xs text-destructive">Options are required</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Correct Index{" "}
                <span className="text-muted-foreground text-xs">(0–3)</span>
              </Label>
              <Input
                type="number"
                {...register("correctAnswerIndex")}
                min={0}
                max={3}
              />
              <p className="text-xs text-muted-foreground">0 = first option</p>
            </div>
            <div className="space-y-2">
              <Label>Day Order</Label>
              <Input type="number" {...register("order")} min={1} />
              <p className="text-xs text-muted-foreground">
                Question sequence #
              </p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin mr-2 w-4 h-4" /> Scheduling...
              </>
            ) : (
              "Schedule Question"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Question Button ───────────────────────────────────────────────────

function DeleteQuestionButton({
  id,
  content,
}: {
  id: number;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const { mutate: deleteQuestion, isPending } = useDeleteQuestion();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteQuestion(id, {
      onSuccess: () => {
        toast({
          title: "Deleted",
          description: "Question removed successfully.",
        });
        setOpen(false);
      },
      onError: (err: any) => {
        toast({
          title: "Delete Failed",
          description:
            err?.message || "Could not delete the question. Please try again.",
          variant: "destructive",
        });
        setOpen(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Delete question">
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" /> Delete
            Question
          </DialogTitle>
          <DialogDescription>
            This also deletes all submissions for this question. Cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/50 border border-border/50 rounded-lg p-3 text-sm text-muted-foreground italic">
          "{content.length > 90 ? content.slice(0, 90) + "…" : content}"
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Deleting...
              </>
            ) : (
              "Yes, Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Clear Leaderboard Button ─────────────────────────────────────────────────

function ClearLeaderboardButton() {
  const [open, setOpen] = useState(false);
  const { mutate: adminReset, isPending } = useAdminReset();
  const { toast } = useToast();

  const handleClear = () => {
    adminReset(undefined, {
      onSuccess: () => {
        toast({
          title: "Leaderboard Cleared",
          description: "All scores reset. New round started.",
        });
        setOpen(false);
        setTimeout(() => window.location.reload(), 800);
      },
      onError: (err: any) => {
        toast({
          title: "Reset Failed",
          description: err?.message || "Could not reset.",
          variant: "destructive",
        });
        setOpen(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
        >
          <RefreshCcw className="w-4 h-4 mr-2" /> Clear Leaderboard
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" /> Clear
            Leaderboard
          </DialogTitle>
          <DialogDescription>
            Resets all scores and starts a fresh round. Participant names and
            device bindings are kept.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-destructive">
            ⚠ Cannot be undone
          </p>
          <ul className="text-sm text-destructive/80 space-y-1 list-disc list-inside">
            <li>All submission scores cleared</li>
            <li>Leaderboard rankings reset</li>
            <li>Questions deactivated for this round</li>
          </ul>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Resetting...
              </>
            ) : (
              "Yes, Clear Everything"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem("admin_auth"),
  );
  const { data: stats } = useAdminStats();
  const { data: results } = useAdminResults();
  const { data: questions } = useAdminQuestions();

  if (!isAuthenticated)
    return <LoginForm onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of exam metrics.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <ClearLeaderboardButton />
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/api/admin/export";
            }}
          >
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem("admin_auth");
              setIsAuthenticated(false);
            }}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Participants"
          value={stats?.totalParticipants ?? 0}
          icon={Users}
        />
        <StatCard
          title="Submissions Today"
          value={stats?.totalSubmissionsToday ?? 0}
          icon={CheckCircle}
        />
        <StatCard
          title="Active Questions"
          value={stats?.activeQuestions ?? 0}
          icon={HelpCircle}
        />
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="questions">Question Bank</TabsTrigger>
        </TabsList>

        {/* Leaderboard */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Live Rankings</CardTitle>
              <span className="text-xs text-muted-foreground">
                {results?.length ?? 0} participants
              </span>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Rank</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Correct</TableHead>
                    <TableHead className="text-right">Speed Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results?.map((entry: any) => (
                    <TableRow key={entry.participantName}>
                      <TableCell className="font-medium">
                        <span
                          className={
                            entry.rank === 1
                              ? "text-yellow-500 font-bold"
                              : entry.rank === 2
                                ? "text-gray-400 font-bold"
                                : entry.rank === 3
                                  ? "text-amber-600 font-bold"
                                  : ""
                          }
                        >
                          #{entry.rank}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.participantName}
                      </TableCell>
                      <TableCell className="font-bold">
                        {entry.totalScore}
                      </TableCell>
                      <TableCell>{entry.correctCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {entry.avgAnswerOrder?.toFixed(1) || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!results?.length && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center h-24 text-muted-foreground"
                      >
                        No submissions yet today.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Question Bank */}
        <TabsContent value="questions" className="space-y-4">
          <div className="flex justify-end">
            <CreateQuestionDialog />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="w-[300px]">Question</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions?.map((q: any) => (
                    <TableRow key={q.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {q.quizDate}
                      </TableCell>
                      <TableCell>
                        <ScheduleBadge
                          quizDate={q.quizDate}
                          scheduledTime={q.scheduledTime}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        #{q.order}
                      </TableCell>
                      <TableCell className="truncate max-w-[300px] text-sm">
                        {q.content}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            q.isActive
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {q.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DeleteQuestionButton id={q.id} content={q.content} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!questions?.length && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center h-24 text-muted-foreground"
                      >
                        No questions yet. Add one above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
