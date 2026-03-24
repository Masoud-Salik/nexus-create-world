import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PrivacyPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyPolicyDialog({ open, onOpenChange }: PrivacyPolicyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Privacy Policy</DialogTitle>
          <DialogDescription>
            Last updated: {new Date().toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold text-base mb-2">1. Information We Collect</h3>
              <p className="text-muted-foreground">
                We collect information you provide directly to us, including your name, email address, 
                profile information, goals, daily activities, and any documents or photos you upload to our service.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">2. How We Use Your Information</h3>
              <p className="text-muted-foreground">
                We use the information we collect to provide, maintain, and improve our services, 
                including AI-powered predictions and personalized recommendations. Your data helps us 
                create better future scenarios and insights tailored to your goals.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">3. Data Security</h3>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your personal 
                information. All data is encrypted in transit and at rest. Your documents and photos are 
                stored securely with access restricted to you alone.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">4. Data Sharing</h3>
              <p className="text-muted-foreground">
                We do not sell your personal information. We may share your information with AI service 
                providers to deliver our core functionality, but only as necessary and under strict 
                confidentiality agreements.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">5. Your Rights</h3>
              <p className="text-muted-foreground">
                You have the right to access, update, or delete your personal information at any time. 
                You can manage most of your information directly through the Settings page. For additional 
                requests, please contact our support team.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">6. AI and Machine Learning</h3>
              <p className="text-muted-foreground">
                Our service uses AI to generate predictions and insights based on your profile, goals, 
                and activities. This processing happens securely and your data is used solely to enhance 
                your personal experience.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">7. Data Retention</h3>
              <p className="text-muted-foreground">
                We retain your information for as long as your account is active or as needed to provide 
                you services. You can request deletion of your account and all associated data at any time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">8. Changes to This Policy</h3>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. We will notify you of any changes 
                by posting the new privacy policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">9. Contact Us</h3>
              <p className="text-muted-foreground">
                If you have any questions about this privacy policy or our data practices, please contact 
                our support team through the app.
              </p>
            </section>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
