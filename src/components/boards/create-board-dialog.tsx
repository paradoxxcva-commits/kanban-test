import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { createBoard } from "@/lib/boards-api";
import { toast } from "sonner";

const COLORS = [
  { id: "brand", className: "bg-brand" },
  { id: "sky", className: "bg-sky-500" },
  { id: "emerald", className: "bg-emerald-500" },
  { id: "violet", className: "bg-violet-500" },
  { id: "rose", className: "bg-rose-500" },
  { id: "amber", className: "bg-amber-500" },
];

export function CreateBoardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("brand");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.org_id) throw new Error("Вы не привязаны к организации.");
      if (!user) throw new Error("Нет сессии.");
      return createBoard({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        org_id: profile.org_id,
        created_by: user.id,
      });
    },
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: ["boards"] });
      onOpenChange(false);
      setName("");
      setDescription("");
      setColor("brand");
      navigate({ to: "/boards/$boardId", params: { boardId: board.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая доска</DialogTitle>
          <DialogDescription>
            Доска будет создана в вашей организации с тремя колонками по умолчанию.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="board-name">Название</Label>
            <Input
              id="board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Релиз 1.2"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="board-desc">Описание (необязательно)</Label>
            <Textarea
              id="board-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кратко о целях доски"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Цвет</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`h-7 w-7 rounded-full ${c.className} transition ${
                    color === c.id ? "ring-2 ring-offset-2 ring-offset-background ring-foreground" : "opacity-70"
                  }`}
                  aria-label={c.id}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? "Создаём…" : "Создать доску"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
