import React from "react";
import { apiClient } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, MailOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminMessages({ messages }) {
  const queryClient = useQueryClient();

  const markRead = async (msg) => {
    await apiClient.entities.ContactMessage.update(msg.id, { read: true });
    queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this message?")) return;
    await apiClient.entities.ContactMessage.delete(id);
    toast.success("Deleted");
    queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
  };

  const unread = messages.filter(m => !m.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1a2744]">Messages ({messages.length})</h2>
          {unread > 0 && <p className="text-sm text-[#c8a951]">{unread} unread</p>}
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No messages yet</div>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`bg-white rounded-xl border p-5 transition-all ${!msg.read ? "border-[#c8a951]/30 bg-[#c8a951]/5" : ""}`}
              onClick={() => !msg.read && markRead(msg)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {!msg.read ? <Mail className="w-4 h-4 text-[#c8a951]" /> : <MailOpen className="w-4 h-4 text-gray-400" />}
                    <span className="font-semibold text-[#1a2744] text-sm">{msg.name}</span>
                    <span className="text-xs text-gray-400">{msg.email}</span>
                    {!msg.read && <Badge className="bg-[#c8a951] text-white border-0 text-[10px]">New</Badge>}
                  </div>
                  {msg.subject && <p className="font-medium text-sm text-[#1a2744] mb-1">{msg.subject}</p>}
                  <p className="text-sm text-gray-500">{msg.message}</p>
                  <p className="text-xs text-gray-400 mt-2">{msg.created_date ? format(new Date(msg.created_date), "MMM d, yyyy h:mm a") : ""}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 shrink-0" onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}