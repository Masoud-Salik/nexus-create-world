import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Book, Calculator, PenTool, Globe, FlaskConical, Music, Atom, Languages } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteSubjectDialog } from "./DeleteSubjectDialog";
import { cn } from "@/lib/utils";

interface Subject {
  id: string;
  subject_name: string;
  icon_name: string;
  color: string;
  weekly_target_minutes: number;
}

interface SubjectManagerProps {
  subjects: Subject[];
  onAdd: (subject: Omit<Subject, "id">) => void;
  onDelete: (id: string) => void;
}

const iconOptions = [
  { value: "book", label: "Book", Icon: Book },
  { value: "calculator", label: "Math", Icon: Calculator },
  { value: "pen", label: "Writing", Icon: PenTool },
  { value: "globe", label: "Geography", Icon: Globe },
  { value: "flask", label: "Science", Icon: FlaskConical },
  { value: "music", label: "Music", Icon: Music },
  { value: "atom", label: "Physics", Icon: Atom },
  { value: "language", label: "Language", Icon: Languages },
];

const colorOptions = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#f97316", label: "Amber" },
];

const targetPresets = [
  { value: 120, label: "2h" },
  { value: 300, label: "5h" },
  { value: 600, label: "10h" },
];

export function SubjectManager({ subjects, onAdd, onDelete }: SubjectManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("book");
  const [color, setColor] = useState("#3b82f6");
  const [targetMinutes, setTargetMinutes] = useState(300);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({ subject_name: name.trim(), icon_name: icon, color, weekly_target_minutes: targetMinutes });
    setName(""); setIcon("book"); setColor("#3b82f6"); setTargetMinutes(300); setShowForm(false);
  };

  return (
    <div className="space-y-3">
      {/* Subject list */}
      {subjects.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No subjects yet. Add your first subject to start planning.</CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {subjects.map(subject => {
            const iconOpt = iconOptions.find(i => i.value === subject.icon_name);
            const IconComp = iconOpt?.Icon || Book;
            return (
              <div key={subject.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: subject.color + "20" }}>
                    <IconComp className="h-4 w-4" style={{ color: subject.color }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{subject.subject_name}</p>
                    <p className="text-[10px] text-muted-foreground">{Math.round(subject.weekly_target_minutes / 60)}h/week</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setSubjectToDelete(subject); setDeleteDialogOpen(true); }}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/30">
          <div>
            <Label className="text-xs font-medium">Subject Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., SAT Math" className="mt-1" />
          </div>

          {/* Icon picker */}
          <div>
            <Label className="text-xs font-medium">Icon</Label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {iconOptions.map(opt => (
                <button key={opt.value} onClick={() => setIcon(opt.value)}
                  className={cn("w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all",
                    icon === opt.value ? "border-primary bg-primary/10 scale-110" : "border-transparent bg-muted/50 hover:bg-muted")}>
                  <opt.Icon className={cn("h-4.5 w-4.5", icon === opt.value ? "text-primary" : "text-muted-foreground")} />
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <Label className="text-xs font-medium">Color</Label>
            <div className="flex gap-2 mt-1.5">
              {colorOptions.map(opt => (
                <button key={opt.value} onClick={() => setColor(opt.value)}
                  className={cn("w-8 h-8 rounded-full border-2 transition-all",
                    color === opt.value ? "border-foreground scale-110 ring-2 ring-primary/30" : "border-transparent")}
                  style={{ backgroundColor: opt.value }} />
              ))}
            </div>
          </div>

          {/* Weekly target */}
          <div>
            <Label className="text-xs font-medium">Weekly Target</Label>
            <div className="flex gap-2 mt-1.5">
              {targetPresets.map(p => (
                <button key={p.value} onClick={() => setTargetMinutes(p.value)}
                  className={cn("px-4 py-1.5 rounded-full text-xs font-medium border transition-all",
                    targetMinutes === p.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:bg-muted")}>
                  {p.label}
                </button>
              ))}
              <Input type="number" value={targetMinutes} onChange={e => setTargetMinutes(Number(e.target.value))}
                min={30} step={30} className="w-20 h-8 text-xs" />
              <span className="text-[10px] text-muted-foreground self-center">min</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">Add Subject</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Subject
        </Button>
      )}

      <DeleteSubjectDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}
        subjectName={subjectToDelete?.subject_name || ""} onConfirm={() => { if (subjectToDelete) { onDelete(subjectToDelete.id); setSubjectToDelete(null); setDeleteDialogOpen(false); } }} />
    </div>
  );
}
