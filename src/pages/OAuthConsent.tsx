import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@/components/Auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";

// Beta namespace — narrow local typing.
type OAuthAPI = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthAPI }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setSessionReady(!!data.session);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessionReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionReady || !authorizationId) return;
    let active = true;
    (async () => {
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [sessionReady, authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorizationId)
      : await oauthApi().denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError("No redirect returned by the authorization server."); }
    window.location.href = target;
  }

  if (!authorizationId) {
    return <main className="p-6 text-center text-sm text-muted-foreground">Missing authorization_id</main>;
  }
  if (sessionReady === null) {
    return <main className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></main>;
  }
  if (!sessionReady) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <p className="text-center text-sm text-muted-foreground mb-4">
            Sign in to continue connecting StudyTime.
          </p>
          <Auth />
        </div>
      </main>
    );
  }
  if (error) {
    return <main className="p-6 text-center text-sm text-destructive">Could not load this authorization request: {error}</main>;
  }
  if (!details) {
    return <main className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></main>;
  }

  const clientName = details.client?.name ?? "an app";
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center">Connect {clientName} to StudyTime</CardTitle>
          <CardDescription className="text-center">
            This will let {clientName} read and modify your study data on your behalf via StudyTime's agent tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            Access includes: viewing subjects &amp; tasks, creating tasks, logging study sessions, and reading your stats.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>Deny</Button>
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}