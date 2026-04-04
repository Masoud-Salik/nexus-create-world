import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Moon, Sun, Bell, User, LogOut, Info, 
  Shield, Trash2, MessageSquare, Download, Sparkles
} from "lucide-react";
import { AboutSection } from "@/components/settings/AboutSection";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PrivacyPolicyDialog } from "@/components/PrivacyPolicyDialog";
import { SignOutConfirmDialog } from "@/components/SignOutConfirmDialog";
import { CompactProfileCard } from "@/components/CompactProfileCard";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { DataExportDialog } from "@/components/settings/DataExportDialog";
import { FeedbackDialog } from "@/components/settings/FeedbackDialog";
import { RingtoneSelector } from "@/components/settings/RingtoneSelector";

const Settings = () => {
  usePageMeta({ title: "Settings", description: "Manage your account settings and preferences." });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Dialog states
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  
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
      .update({
        push_notifications_enabled: push,
        email_updates_enabled: emailPref
      })
      .eq('id', user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Preferences updated" });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">Please log in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-3 py-4 sm:p-6 overflow-x-hidden w-full max-w-[100vw] box-border">
      <div className="mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
      
      <div className="flex-1 max-w-lg mx-auto w-full pb-20 overflow-hidden box-border">
        <h1 className="mb-4 text-2xl font-bold">Settings</h1>
        
        <Tabs defaultValue="account" className="w-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="account" className="gap-1.5">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="more" className="gap-1.5">
              <Info className="h-4 w-4" />
              More
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              About
            </TabsTrigger>
          </TabsList>
          
          {/* ACCOUNT TAB */}
          <TabsContent value="account" className="space-y-3">
            {/* Compact Profile Card */}
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

            {/* Email */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between overflow-hidden">
                <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-muted-foreground truncate">{email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Theme Toggle */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Dark Mode</span>
                </div>
                <Switch 
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </CardContent>
            </Card>

            {/* Ringtone Selector */}
            <RingtoneSelector />

            {/* Notifications */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bell className="h-4 w-4" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="push" className="text-sm">Push Notifications</Label>
                  <Switch 
                    id="push"
                    checked={pushNotifications}
                    onCheckedChange={(checked) => {
                      setPushNotifications(checked);
                      updateNotificationPreferences(checked, emailUpdates);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="email" className="text-sm">Email Updates</Label>
                  <Switch 
                    id="email"
                    checked={emailUpdates}
                    onCheckedChange={(checked) => {
                      setEmailUpdates(checked);
                      updateNotificationPreferences(pushNotifications, checked);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sign Out */}
            <Button 
              variant="outline" 
              onClick={() => setSignOutDialogOpen(true)}
              className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </TabsContent>

          {/* MORE TAB */}
          <TabsContent value="more" className="space-y-3">
            {/* Export Data */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Export Data</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setExportDialogOpen(true)}>
                  Export
                </Button>
              </CardContent>
            </Card>

            {/* Privacy Policy */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Privacy Policy</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPrivacyDialogOpen(true)}>
                  View
                </Button>
              </CardContent>
            </Card>

            {/* Terms of Service */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Terms of Service</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toast({ title: "Coming soon" })}>
                  View
                </Button>
              </CardContent>
            </Card>

            {/* Send Feedback */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Send Feedback</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFeedbackDialogOpen(true)}>
                  Write
                </Button>
              </CardContent>
            </Card>

            {/* Delete Account */}
            <Card className="border-destructive/30">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">Delete Account</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteAccountDialogOpen(true)}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>

            {/* App Version */}
            <p className="text-center text-xs text-muted-foreground pt-4">
              Version 1.0.0 • Built with ❤️
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <PrivacyPolicyDialog 
        open={privacyDialogOpen} 
        onOpenChange={setPrivacyDialogOpen} 
      />
      
      <SignOutConfirmDialog
        open={signOutDialogOpen}
        onOpenChange={setSignOutDialogOpen}
        onConfirm={handleSignOut}
      />

      <DeleteAccountDialog
        open={deleteAccountDialogOpen}
        onOpenChange={setDeleteAccountDialogOpen}
        userEmail={email}
      />

      <DataExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        userId={user.id}
      />

      <FeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
      />
    </div>
  );
};

export default Settings;
