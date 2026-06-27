import PocketBase from "pocketbase";

let pbInstance: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (!pbInstance) {
    const baseUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/pb`
        : "http://localhost:8090";
    pbInstance = new PocketBase(baseUrl);
  }
  return pbInstance;
}

export async function setPocketBaseAuth(token: string): Promise<void> {
  const pb = getPocketBase();
  pb.authStore.save(token, null);
}

export function clearPocketBaseAuth(): void {
  const pb = getPocketBase();
  pb.authStore.clear();
}

export interface PBMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  read_at: string | null;
  created: string;
  updated: string;
}

export async function pbSendMessage(params: {
  senderId: string;
  recipientId: string;
  body: string;
  attachmentUrl?: string;
  attachmentName?: string;
}): Promise<PBMessage> {
  const pb = getPocketBase();
  const record = await pb.collection("pb_messages").create({
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    body: params.body,
    attachment_url: params.attachmentUrl ?? null,
    attachment_name: params.attachmentName ?? null,
  });
  return record as unknown as PBMessage;
}

export async function pbGetMessages(
  userId: string,
  peerId: string,
  limit = 500
): Promise<PBMessage[]> {
  const pb = getPocketBase();
  const filter = `sender_id="${userId}" && recipient_id="${peerId}" || sender_id="${peerId}" && recipient_id="${userId}"`;
  const records = await pb.collection("pb_messages").getFullList({
    filter,
    sort: "created",
    limit,
  });
  return records as unknown as PBMessage[];
}

export async function pbMarkAsRead(messageId: string): Promise<void> {
  const pb = getPocketBase();
  await pb.collection("pb_messages").update(messageId, {
    read_at: new Date().toISOString(),
  });
}

export function pbSubscribeToMessages(
  userId: string,
  peerId: string,
  callback: (msg: PBMessage) => void
): () => void {
  const pb = getPocketBase();
  const filter = `sender_id="${userId}" && recipient_id="${peerId}" || sender_id="${peerId}" && recipient_id="${userId}"`;

  pb.collection("pb_messages").subscribe("*", (e: any) => {
    if (e.action === "create") {
      const msg = e.record as unknown as PBMessage;
      if (
        (msg.sender_id === userId && msg.recipient_id === peerId) ||
        (msg.sender_id === peerId && msg.recipient_id === userId)
      ) {
        callback(msg);
      }
    }
  });

  return () => {
    pb.collection("pb_messages").unsubscribe("*");
  };
}
