import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Moon, Sun, Bell, User, LogOut, Info,
  Shield, Trash2, MessageSquare, Download, ChevronRight,
  Volume2, Share2, Camera
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useIsMobile } from "@/hooks/use-mobile";
import { PrivacyPolicyDialog } from "@/components/PrivacyPolicyDialog";
import { SignOutConfirmDialog } from "@/components/SignOutConfirmDialog";
import { CompactProfileCard } from "@/components/CompactProfileCard";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { DataExportDialog } from "@/components/settings/DataExportDialog";
import { FeedbackDialog } from "@/components/settings/FeedbackDialog";
import { RingtoneSelector } from "@/components/settings/RingtoneSelector";
import { AboutSection } from "@/components/settings/AboutSection";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

// Reusable settings row
function SettingsRow({
  icon: Icon, label, onClick, trailing, destructive, className
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 ${className || ""}`}
      disabled={!onClick && !trailing}
    >
      <div className={`p-2 rounded-lg ${destructive ? "bg-destructive/10" : "bg-muted"}`}>
        <Icon className={`h-4 w-4 ${destructive ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <span className={`text-sm font-medium flex-1 text-left ${destructive ? "text-destructive" : "text-foreground"}`}>
        {label}
      </span>
      {trailing || (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </button>
  );
}

function SectionHeader({ label, color = "text-primary" }: { label: string; color?: string }) {
  return <p className={`text-xs font-semibold uppercase tracking-wider px-4 pt-4 pb-2 ${color}`}>{label}</p>;
}

const Settings = () => {
  usePageMeta({ title: "Settings", description: "Manage your account settings and preferences." });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Dialog states
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [ringtoneOpen, setRingtoneOpen] = useState(false);

  // Notification preferences
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);

  // Profile data
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [motto, setMotto] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setName(data.name || "");
      setAge(data.age?.toString() || "");
      setOccupation(data.occupation_or_status || "");
      setMotto(data.personal_motto || "");
      setAvatarUrl(data.avatar_url || null);
      setPushNotifications(data.push_notifications_enabled ?? true);
      setEmailUpdates(data.email_updates_enabled ?? true);
    }
  };

  const updateNotificationPreferences = async (push: boolean, emailPref: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ push_notifications_enabled: push, email_updates_enabled: emailPref })
      .eq('id', user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: "StudyTime", text: "Check out StudyTime!", url: window.location.origin });
    } catch {
      await navigator.clipboard.writeText(window.location.origin);
      toast({ title: "Link copied!" });
    }
  };

  const isGuest = !user;

  return (
    <div className="flex min-h-screen flex-col bg-background px-3 py-4 sm:p-6 overflow-x-hidden w-full max-w-[100vw] box-border">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full pb-20 overflow-hidden box-border space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* SECTION: Profile & Account */}
        <Card className="overflow-hidden divide-y divide-border">
          {isGuest ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Guest Mode</p>
                <p className="text-sm text-muted-foreground mt-1">Sign in to save your progress</p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => navigate("/chat")} variant="outline" size="sm">Sign In</Button>
                <Button onClick={() => navigate("/chat")} size="sm">Sign Up</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4">
                <CompactProfileCard
                  userId={user.id}
                  name={name}
                  motto={motto}
                  avatarUrl={avatarUrl}
                  age={age}
                  occupation={occupation}
                  onProfileUpdate={(data) => {
                    setName(data.name);
                    setMotto(data.motto);
                    setAge(data.age);
                    setOccupation(data.occupation);
                    setAvatarUrl(data.avatarUrl);
                  }}
                />
              </div>
              <SettingsRow icon={User} label={email || "Email"} />
              <SettingsRow icon={Camera} label="Study Selfies" onClick={() => navigate("/ai-memory")} />
              <SettingsRow icon={Download} label="Export Data" onClick={() => setExportDialogOpen(true)} />
            </>
          )}
        </Card>

        {/* SECTION: General */}
        <div>
          <SectionHeader label="General" />
          <Card className="overflow-hidden divide-y divide-border">
            <SettingsRow
              icon={theme === "dark" ? Moon : Sun}
              label="Dark Mode"
              trailing={
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              }
            />

            <Collapsible open={ringtoneOpen} onOpenChange={setRingtoneOpen}>
              <CollapsibleTrigger asChild>
                <div>
                  <SettingsRow
                    icon={Volume2}
                    label="Timer Ringtone"
                    trailing={<ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${ringtoneOpen ? "rotate-90" : ""}`} />}
                    onClick={() => setRingtoneOpen(!ringtoneOpen)}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <RingtoneSelector />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {!isGuest && (
              <>
                <SettingsRow
                  icon={Bell}
                  label="Push Notifications"
                  trailing={
                    <Switch
                      checked={pushNotifications}
                      onCheckedChange={(checked) => {
                        setPushNotifications(checked);
                        updateNotificationPreferences(checked, emailUpdates);
                      }}
                    />
                  }
                />
                <SettingsRow
                  icon={Bell}
                  label="Email Updates"
                  trailing={
                    <Switch
                      checked={emailUpdates}
                      onCheckedChange={(checked) => {
                        setEmailUpdates(checked);
                        updateNotificationPreferences(pushNotifications, checked);
                      }}
                    />
                  }
                />
              </>
            )}
          </Card>
        </div>

        {/* SECTION: About */}
        <div>
          <SectionHeader label="About" />
          <Card className="overflow-hidden divide-y divide-border">
            <SettingsRow icon={Share2} label="Share App" onClick={handleShare} />
            <SettingsRow icon={Shield} label="Privacy Policy" onClick={() => setPrivacyDialogOpen(true)} />
            <SettingsRow icon={Shield} label="Terms of Service" onClick={() => toast({ title: "Coming soon" })} />
            <SettingsRow icon={MessageSquare} label="Send Feedback" onClick={() => setFeedbackDialogOpen(true)} />
            {isMobile ? (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <div>
                    <SettingsRow icon={Info} label="About StudyTime" onClick={() => {}} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <AboutSection />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <SettingsRow icon={Info} label="About StudyTime" onClick={() => navigate("/about")} />
            )}
          </Card>
        </div>

        {/* SECTION: Danger Zone */}
        {!isGuest && (
          <div>
            <SectionHeader label="Danger Zone" color="text-destructive" />
            <Card className="overflow-hidden divide-y divide-border border-destructive/30">
              <SettingsRow
                icon={Trash2}
                label="Delete Account"
                onClick={() => setDeleteAccountDialogOpen(true)}
                destructive
              />
            </Card>
            <Button
              variant="outline"
              onClick={() => setSignOutDialogOpen(true)}
              className="w-full gap-2 mt-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2 pb-4">Version 1.0.0</p>
      </div>

      {/* Dialogs */}
      <PrivacyPolicyDialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen} />
      <SignOutConfirmDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen} onConfirm={handleSignOut} />
      <DeleteAccountDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen} userEmail={email} />
      {user && (
        <DataExportDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} userId={user.id} />
      )}
      <FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} />
    </div>
  );
};

export default Settings;
