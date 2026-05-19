import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DoubleConfirmDelete({
  open,
  onOpenChange,
  title,
  step1Description,
  step2Description,
  confirmLabel = "Delete permanently",
  onConfirm,
}) {
  const [step, setStep] = useState(1);

  const handleOpenChange = (next) => {
    if (!next) setStep(1);
    onOpenChange?.(next);
  };

  const handleFirst = () => setStep(2);

  const handleFinal = () => {
    onConfirm?.();
    setStep(1);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="bg-[#0a0f1c] border border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            {step === 1 ? step1Description : step2Description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
          {step === 1 ? (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleFirst();
              }}
              className="bg-amber-600 hover:bg-amber-500"
            >
              Continue
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              onClick={handleFinal}
              className="bg-red-600 hover:bg-red-500"
            >
              {confirmLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

