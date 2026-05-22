import { describe, expect, it } from "vitest";
import { countUnreadMessageSenders } from "@/components/Header";

describe("countUnreadMessageSenders", () => {
  it("counts unread conversations, not total unread messages", () => {
    expect(countUnreadMessageSenders([
      { conversationId: 1, otherUserId: 10, unreadCount: 3 },
      { conversationId: 2, otherUserId: 11, unreadCount: 1 },
      { conversationId: 3, otherUserId: 12, unreadCount: 0 },
    ])).toBe(2);
  });

  it("does not double-count the same sender", () => {
    expect(countUnreadMessageSenders([
      { conversationId: 1, otherUserId: 10, unreadCount: 1 },
      { conversationId: 2, otherUserId: 10, unreadCount: 2 },
    ])).toBe(1);
  });
});
