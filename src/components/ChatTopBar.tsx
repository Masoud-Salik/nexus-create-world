import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreVertical, Trash2, Palette, Edit3, Activity, User, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ChatTopBarProps {
  conversationId: string | null;
  conversationTitle: string;
  onDeleteChat: () => void;
  onRenameChat: (newTitle: string) => void;
}

export function ChatTopBar({ 
  conversationId, 
  conversationTitle, 
  onDeleteChat,
  onRenameChat 
}: ChatTopBarProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Me");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(conversationTitle);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    setNewTitle(conversationTitle);
  }, [conversationTitle]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("avatar_url, name")
      .eq("id", user.id)
      .single();

    if (data) {
      setUserName(data.name || "Me");
    }
  };

  const handleDeleteChat = () => {
    onDeleteChat();
    toast({
      title: "Chat deleted",
      description: "The conversation has been removed.",
    });
  };

  const handleRename = () => {
    if (newTitle.trim()) {
      onRenameChat(newTitle.trim());
      setShowRenameDialog(false);
      toast({
        title: "Chat renamed",
        description: "The conversation has been renamed.",
      });
    }
  };

  const cycleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    toast({
      title: "Theme changed",
      description: `Switched to ${newTheme} mode`,
    });
  };

  const _unused = () => {
    toast({
      title: "Placeholder",
      description: `Switched to ${theme === "light" ? "dark" : theme === "dark" ? "system" : "light"} mode`,
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Three-dots menu - now in the accessible spot */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="tap-effect">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover border border-border z-50">
            <DropdownMenuItem onClick={() => setShowRenameDialog(true)} className="gap-2 cursor-pointer">
              <Edit3 className="h-4 w-4" />
              Rename Chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={cycleTheme} className="gap-2 cursor-pointer">
              <Palette className="h-4 w-4" />
              Appearance ({theme})
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleDeleteChat} 
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Delete Chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chat-title">Chat Title</Label>
              <Input
                id="chat-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter chat title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}