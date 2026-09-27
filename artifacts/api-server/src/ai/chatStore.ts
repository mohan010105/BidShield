import { db, chatSessionsTable, chatMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export interface StoredSession {
  id: string;
  userId: string;
  title: string;
  contextType: string;
  contextId?: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: any;
  createdAt: string;
}

// In-memory fallback cache
const memorySessions = new Map<string, StoredSession>();
const memoryMessages = new Map<string, StoredMessage[]>();

export class ChatStore {
  static async createSession(data: {
    sessionId?: string;
    userId?: string;
    title?: string;
    contextType?: string;
    contextId?: string;
    language?: string;
  }): Promise<StoredSession> {
    const sessionId = data.sessionId || crypto.randomUUID();
    const now = new Date().toISOString();
    const session: StoredSession = {
      id: sessionId,
      userId: data.userId || "investigator_1",
      title: data.title || "New Investigation Chat",
      contextType: data.contextType || "general",
      contextId: data.contextId || undefined,
      language: data.language || "en-IN",
      createdAt: now,
      updatedAt: now,
    };

    memorySessions.set(sessionId, session);
    memoryMessages.set(sessionId, []);

    try {
      await db.insert(chatSessionsTable).values({
        sessionId,
        userId: session.userId,
        title: session.title,
        contextType: session.contextType,
        contextId: session.contextId,
        language: session.language,
      });
    } catch {
      // Graceful in-memory fallback
    }

    return session;
  }

  static async getSession(sessionId: string): Promise<StoredSession | null> {
    if (memorySessions.has(sessionId)) {
      return memorySessions.get(sessionId)!;
    }

    try {
      const rows = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.sessionId, sessionId)).limit(1);
      if (rows.length > 0) {
        const row = rows[0];
        const session: StoredSession = {
          id: row.sessionId,
          userId: row.userId,
          title: row.title,
          contextType: row.contextType || "general",
          contextId: row.contextId || undefined,
          language: row.language,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
        memorySessions.set(sessionId, session);
        return session;
      }
    } catch {
      // Graceful fallback
    }

    return null;
  }

  static async getSessions(userId: string = "investigator_1"): Promise<StoredSession[]> {
    const list: StoredSession[] = [];

    try {
      const rows = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.userId, userId)).orderBy(desc(chatSessionsTable.updatedAt));
      for (const row of rows) {
        list.push({
          id: row.sessionId,
          userId: row.userId,
          title: row.title,
          contextType: row.contextType || "general",
          contextId: row.contextId || undefined,
          language: row.language,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        });
      }
    } catch {
      // Fallback to memory
      for (const s of memorySessions.values()) {
        if (s.userId === userId) list.push(s);
      }
    }

    if (list.length === 0 && memorySessions.size > 0) {
      for (const s of memorySessions.values()) {
        if (s.userId === userId) list.push(s);
      }
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  static async deleteSession(sessionId: string): Promise<boolean> {
    memorySessions.delete(sessionId);
    memoryMessages.delete(sessionId);

    try {
      await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId));
      await db.delete(chatSessionsTable).where(eq(chatSessionsTable.sessionId, sessionId));
      return true;
    } catch {
      return true;
    }
  }

  static async addMessage(
    sessionId: string,
    message: { role: "user" | "assistant" | "system" | "tool"; content: string; metadata?: any }
  ): Promise<StoredMessage> {
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    const stored: StoredMessage = {
      id: msgId,
      sessionId,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      createdAt: now,
    };

    const msgs = memoryMessages.get(sessionId) || [];
    msgs.push(stored);
    memoryMessages.set(sessionId, msgs);

    // Update session timestamp & title if first user message
    const session = memorySessions.get(sessionId);
    if (session) {
      session.updatedAt = now;
      if (message.role === "user" && session.title === "New Investigation Chat") {
        session.title = message.content.slice(0, 45).trim() + (message.content.length > 45 ? "…" : "");
      }
    }

    try {
      await db.insert(chatMessagesTable).values({
        sessionId,
        role: message.role,
        content: message.content,
        metadata: message.metadata ? JSON.stringify(message.metadata) : null,
      });

      if (session) {
        await db.update(chatSessionsTable).set({
          title: session.title,
          updatedAt: new Date(),
        }).where(eq(chatSessionsTable.sessionId, sessionId));
      }
    } catch {
      // Graceful fallback
    }

    return stored;
  }

  static async getMessages(sessionId: string): Promise<StoredMessage[]> {
    if (memoryMessages.has(sessionId) && memoryMessages.get(sessionId)!.length > 0) {
      return memoryMessages.get(sessionId)!;
    }

    try {
      const rows = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId)).orderBy(chatMessagesTable.id);
      const msgs: StoredMessage[] = rows.map((r) => ({
        id: String(r.id),
        sessionId: r.sessionId,
        role: r.role as any,
        content: r.content,
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        createdAt: r.createdAt.toISOString(),
      }));
      memoryMessages.set(sessionId, msgs);
      return msgs;
    } catch {
      return memoryMessages.get(sessionId) || [];
    }
  }
}
