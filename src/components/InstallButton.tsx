import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

export function InstallButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIOS());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  // Show button only when we can actually prompt, or on iOS where we show instructions.
  if (!deferred && !ios) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (ios) setIosHelp(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        size="sm"
        variant="outline"
        className={className}
        aria-label="Install Bookary app"
      >
        <Download className="mr-1.5 h-4 w-4" />
        Install app
      </Button>
      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Bookary on iPhone / iPad</DialogTitle>
            <DialogDescription>
              iOS doesn't allow one-tap install. Add Bookary to your Home Screen in two steps:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Share className="mt-0.5 h-4 w-4 text-primary" />
              <span>Tap the <strong>Share</strong> button in Safari's toolbar.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 grid h-4 w-4 place-items-center rounded border border-primary text-[10px] font-bold text-primary">+</span>
              <span>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
