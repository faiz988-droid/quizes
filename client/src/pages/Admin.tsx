import { useState } from "react";
import { useAdminLogin, useAdminStats, useAdminResults, useCreateQuestion, useAdminQuestions, useDeleteQuestion } from "@/hooks/use-admin";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, Plus, Trash2, Download, LogOut, Users, CheckCircle, HelpCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// --- Components ---

function StatCard({ title, value, icon: Icon }: { title: string, value: string | number, icon: any }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const { mutate, isPending } = useAdminLogin();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ username: user, password: pass }, {
      onSuccess: () => {
        localStorage.setItem("admin_auth", "true");
        onLogin();
      },
      onError: () => {
        toast({ title: "Login Failed", description: "Invalid credentials", variant: "destructive" });
      }
    });
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
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : "Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function CreateQuestionDialog() {
  const { mutate, isPending } = useCreateQuestion();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = (data: any) => {
    const formatted = {
      ...data,
      options: data.options.split('\n').filter(Boolean),
      correctAnswerIndex: parseInt(data.correctAnswerIndex),
      order: parseInt(data.order),
      quizDate: format(new Date(), 'yyyy-MM-dd') // Default to today for simplicity
    };
    
    mutate(formatted, {
      onSuccess: () => {
        toast({ title: "Success", description: "Question created" });
        setOpen(false);
        reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Add Question</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Daily Question</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Question Content</Label>
            <Textarea {...register("content")} required />
          </div>
          <div className="space-y-2">
            <Label>Options (one per line)</Label>
            <Textarea {...register("options")} required placeholder="Option A&#10;Option B&#10;Option C" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Correct Index (0-3)</Label>
              <Input type="number" {...register("correctAnswerIndex")} required min={0} />
            </div>
            <div className="space-y-2">
              <Label>Order (Day)</Label>
              <Input type="number" {...register("order")} defaultValue={1} required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Admin Page ---

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem("admin_auth"));
  const { data: stats } = useAdminStats();
  const { data: results } = useAdminResults();
  const { data: questions } = useAdminQuestions();
  const { mutate: deleteQuestion } = useDeleteQuestion();

  if (!isAuthenticated) return <LoginForm onLogin={() => setIsAuthenticated(true)} />;

  const downloadExport = () => {
    window.location.href = "/api/admin/export";
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of today's exam metrics.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadExport}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="ghost" onClick={() => {
            localStorage.removeItem("admin_auth");
            setIsAuthenticated(false);
          }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard 
          title="Total Participants" 
          value={stats?.totalParticipants || 0} 
          icon={Users} 
        />
        <StatCard 
          title="Submissions Today" 
          value={stats?.totalSubmissionsToday || 0} 
          icon={CheckCircle} 
        />
        <StatCard 
          title="Active Questions" 
          value={stats?.activeQuestions || 0} 
          icon={HelpCircle} 
        />
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="questions">Question Bank</TabsTrigger>
        </TabsList>
        
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Rank</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Correct</TableHead>
                    <TableHead className="text-right">Speed Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results?.map((entry: any) => (
                    <TableRow key={entry.participantName}>
                      <TableCell className="font-medium">#{entry.rank}</TableCell>
                      <TableCell>{entry.participantName}</TableCell>
                      <TableCell>{entry.totalScore}</TableCell>
                      <TableCell>{entry.correctCount}</TableCell>
                      <TableCell className="text-right">{entry.avgAnswerOrder?.toFixed(1) || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {!results?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        No submissions yet today.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <TableHead className="w-[400px]">Question</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions?.map((q: any) => (
                    <TableRow key={q.id}>
                      <TableCell>{q.quizDate}</TableCell>
                      <TableCell className="truncate max-w-[400px]">{q.content}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${q.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {q.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteQuestion(q.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
