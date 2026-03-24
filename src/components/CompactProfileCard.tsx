import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { User, Camera, Save, ChevronRight, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAvatarDisplayUrl } from "@/utils/avatarUtils";

interface CompactProfileCardProps {
  userId: string;
  name: string;
  motto: string;
  avatarUrl: string | null;
  age: string;
  occupation: string;
  onProfileUpdate: (data: { name: string; motto: string; age: string; occupation: string; avatarUrl: string | null }) => void;
}

export const CompactProfileCard = ({
  userId,
  name,
  motto,
  avatarUrl,
  age,
  occupation,
  onProfileUpdate,
}: CompactProfileCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editMotto, setEditMotto] = useState(motto);
  const [editAge, setEditAge] = useState(age);
  const [editOccupation, setEditOccupation] = useState(occupation);
  const [editAvatarUrl, setEditAvatarUrl] = useState(avatarUrl);
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | null>(null);
  const [editDisplayAvatarUrl, setEditDisplayAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    getAvatarDisplayUrl(avatarUrl).then(setDisplayAvatarUrl);
  }, [avatarUrl]);

  const handleOpen = () => {
    setEditName(name);
    setEditMotto(motto);
    setEditAge(age);
    setEditOccupation(occupation);
    setEditAvatarUrl(avatarUrl);
    setIsExpanded(true);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    setUploading(true);
    try {
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the file path, not a public URL (bucket is private)
      setEditAvatarUrl(fileName);
      const signedUrl = await getAvatarDisplayUrl(fileName);
      setEditDisplayAvatarUrl(signedUrl);
      toast({ title: "Photo uploaded", description: "Save to apply changes" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName.trim() || null,
          personal_motto: editMotto.trim() || null,
          age: editAge ? parseInt(editAge) : null,
          occupation_or_status: editOccupation.trim() || null,
          avatar_url: editAvatarUrl,
        })
        .eq('id', userId);

      if (error) throw error;

      onProfileUpdate({
        name: editName,
        motto: editMotto,
        age: editAge,
        occupation: editOccupation,
        avatarUrl: editAvatarUrl,
      });
      setIsExpanded(false);
      toast({ title: "Profile saved", description: "Your changes have been saved" });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card 
        className="cursor-pointer hover:border-primary/50 transition-colors group overflow-hidden w-full"
        onClick={handleOpen}
      >
        <CardContent className="p-4 overflow-hidden w-full">
          <div className="flex items-center gap-3 w-full overflow-hidden">
            <Avatar className="h-12 w-12 ring-2 ring-primary/20 shrink-0 flex-none">
              <AvatarImage src={displayAvatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <h3 className="font-semibold text-base truncate">{name || "Set your name"}</h3>
              {motto && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 overflow-hidden">
                  <Quote className="h-3 w-3 shrink-0 flex-none" />
                  <span className="italic truncate block">{motto}</span>
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 flex-none" />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Edit Profile
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-24 w-24 ring-2 ring-primary/30">
                <AvatarImage src={editDisplayAvatarUrl || displayAvatarUrl || undefined} />
                <AvatarFallback className="bg-primary/10">
                  <User className="h-10 w-10 text-primary" />
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Camera className="h-4 w-4" />
                {uploading ? "Uploading..." : "Change Photo"}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-motto">Personal Motto</Label>
                <Input
                  id="edit-motto"
                  value={editMotto}
                  onChange={(e) => setEditMotto(e.target.value)}
                  placeholder="Your life motto"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-age">Age</Label>
                  <Input
                    id="edit-age"
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    placeholder="Age"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-occupation">Occupation</Label>
                  <Input
                    id="edit-occupation"
                    value={editOccupation}
                    onChange={(e) => setEditOccupation(e.target.value)}
                    placeholder="What you do"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpanded(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
