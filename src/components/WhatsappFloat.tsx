import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getWhatsappSettings } from "@/lib/settings.functions";

export const OPEN_WHATSAPP_EVENT = "open-whatsapp-chat";

export function openWhatsappChat() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_WHATSAPP_EVENT));
}

export function WhatsappFloat() {
  const fetchSettings = useServerFn(getWhatsappSettings);
  const { data } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 5 * 60_000,
  });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_WHATSAPP_EVENT, handler);
    return () => window.removeEventListener(OPEN_WHATSAPP_EVENT, handler);
  }, []);

  useEffect(() => {
    if (data?.greeting && !message) setMessage(data.greeting);
  }, [data?.greeting]);

  if (!data || !data.enabled || !data.number) return null;

  const send = () => {
    const text = encodeURIComponent(message.trim() || data.greeting);
    window.open(`https://wa.me/${data.number}?text=${text}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 print:hidden">
      {open ? (
        <div className="w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border bg-card shadow-xl">
          <div className="flex items-start justify-between gap-3 bg-[#25D366] p-4 text-white">
            <div>
              <p className="font-semibold">{data.label}</p>
              <p className="text-xs opacity-90">Biasanya membalas dalam beberapa menit</p>
            </div>
            <button type="button" aria-label="Tutup obrolan" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Halo! Ada yang bisa kami bantu? Kirim pesan dan kami lanjutkan lewat WhatsApp.
            </p>
            <Textarea
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              aria-label="Pesan WhatsApp"
            />
            <Button type="button" className="w-full gap-2" onClick={send}>
              <Send className="h-4 w-4" /> Kirim lewat WhatsApp
            </Button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Chat WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
      </button>
    </div>
  );
}
