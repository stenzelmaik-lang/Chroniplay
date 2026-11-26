"use client";
// Orte: confirmations and short text questions inside the page. Native confirm()/prompt() are blocked in
// some browsers (the Claude app browser answers them with "no"), which made buttons look dead.
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Question = { text: string; confirm: string; input?: { label: string; value: string } };

export function useLocationDialog() {
  const [question, setQuestion] = useState<Question | null>(null);
  const pending = useRef<((answer: string | null) => void) | null>(null);
  const finish = useCallback((answer: string | null) => { const resolve = pending.current; pending.current = null; setQuestion(null); resolve?.(answer); }, []);
  const open = useCallback((next: Question) => new Promise<string | null>(resolve => { pending.current?.(null); pending.current = resolve; setQuestion(next); }), []);
  useEffect(() => () => { pending.current?.(null); pending.current = null; }, []);
  /** Yes/no inside the page. Resolves true only on the confirm button. */
  const ask = useCallback(async (text: string, confirm = "Bestätigen") => (await open({ text, confirm })) !== null, [open]);
  /** Short text inside the page. Resolves the trimmed text, or null when cancelled or empty. */
  const askText = useCallback(async (text: string, label: string, confirm = "Übernehmen") => {
    const answer = await open({ text, confirm, input: { label, value: "" } });
    return answer?.trim() ? answer.trim() : null;
  }, [open]);
  const dialog = <AlertDialog open={question !== null} onOpenChange={value => { if (!value) finish(null); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Bitte bestätigen</AlertDialogTitle>
        <AlertDialogDescription>{question?.text}</AlertDialogDescription>
      </AlertDialogHeader>
      {question?.input && <label className="field"><span>{question.input.label}</span>
        <input autoFocus value={question.input.value} maxLength={500} onChange={event => setQuestion(current => current?.input ? { ...current, input: { ...current.input, value: event.target.value } } : current)}
          onKeyDown={event => { if (event.key === "Enter" && question.input?.value.trim()) { event.preventDefault(); finish(question.input.value); } }} /></label>}
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => finish(null)}>Abbrechen</AlertDialogCancel>
        <AlertDialogAction disabled={!!question?.input && !question.input.value.trim()} onClick={() => finish(question?.input ? question.input.value : "yes")}>{question?.confirm}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { ask, askText, dialog };
}
