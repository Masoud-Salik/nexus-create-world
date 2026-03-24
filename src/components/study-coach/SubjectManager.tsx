import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteSubjectDialog } from "./DeleteSubjectDialog";

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
  { value: "book", label: "Book" },
  { value: "calculator", label: "Calculator" },
  { value: "pen", label: "Writing" },
  { value: "globe", label: "Geography" },
  { value: "flask", label: "Science" },
  { value: "music", label: "Music" },
];

const colorOptions = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
];

export function SubjectManager({ subjects, onAdd, onDelete }: SubjectManagerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("book");
  const [color, setColor] = useState("#3b82f6");
  const [targetMinutes, setTargetMinutes] = useState(300);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  const handleDeleteClick = (subject: Subject) => {
    setSubjectToDelete(subject);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (subjectToDelete) {
      onDelete(subjectToDelete.id);
      setSubjectToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      subject_name: name.trim(),
      icon_name: icon,
      color,
      weekly_target_minutes: targetMinutes,
    });

    setName("");
    setIcon("book");
    setColor("#3b82f6");
    setTargetMinutes(300);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Subjects</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Subject</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Subject Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., SAT Math"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Icon</Label>
                  <Select value={icon} onValueChange={setIcon}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Color</Label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: opt.value }}
                            />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="target">Weekly Target (minutes)</Label>
                <Input
                  id="target"
                  type="number"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  min={30}
                  step={30}
                />
              </div>

              <Button type="submit" className="w-full">
                Add Subject
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {subjects.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No subjects added yet. Add your first subject to start planning.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: subject.color }}
                />
                <span className="font-medium text-foreground">{subject.subject_name}</span>
                <span className="text-xs text-muted-foreground">
                  {subject.weekly_target_minutes} min/week
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteClick(subject)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <DeleteSubjectDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        subjectName={subjectToDelete?.subject_name || ""}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
