import { describe, expect, it } from "vitest";
import {
  formatInrAmount,
  getPostMediaItems,
  getStoryMediaType,
  getStoryViews,
  inferPlanId,
  isVideoUrl,
  resolveMediaUrl,
  resolveNotificationPath,
  toDisplayMediaUrl,
} from "@/lib/service-helpers";

describe("resolveMediaUrl", () => {
  it("reads direct media response URLs", () => {
    expect(resolveMediaUrl({ url: "http://localhost:8080/api/v1/media/files/a.png" }))
      .toBe("http://localhost:8080/api/v1/media/files/a.png");
  });

  it("reads media-service ApiResponse envelope URLs", () => {
    expect(resolveMediaUrl({
      status: 200,
      message: "Media uploaded successfully",
      data: { url: "http://localhost:8080/api/v1/media/files/b.png" },
    })).toBe("http://localhost:8080/api/v1/media/files/b.png");
  });

  it("returns an empty string for missing or deeply invalid media payloads", () => {
    expect(resolveMediaUrl(null)).toBe("");
    expect(resolveMediaUrl({ data: { data: { data: { url: "too-deep" } } } })).toBe("");
  });
});

describe("media display helpers", () => {
  it("converts local gateway media URLs to same-origin paths", () => {
    expect(toDisplayMediaUrl("http://localhost:8080/api/v1/media/files/image.png?download=false"))
      .toBe("/api/v1/media/files/image.png?download=false");
  });

  it("keeps remote and relative URLs unchanged", () => {
    expect(toDisplayMediaUrl("https://cdn.example.com/image.png")).toBe("https://cdn.example.com/image.png");
    expect(toDisplayMediaUrl("/uploads/image.png")).toBe("/uploads/image.png");
    expect(toDisplayMediaUrl()).toBe("");
  });

  it("detects video URLs from extensions and cloud paths", () => {
    expect(isVideoUrl("https://cdn.example.com/video/upload/sample")).toBe(true);
    expect(isVideoUrl("https://cdn.example.com/file.mp4?token=1")).toBe(true);
    expect(isVideoUrl("https://cdn.example.com/image.png")).toBe(false);
  });

  it("normalizes post media arrays and fallback fields", () => {
    expect(getPostMediaItems({
      mediaUrls: [
        "https://cdn.example.com/photo.jpg",
        { url: "https://cdn.example.com/clip.webm", mediaType: "VIDEO" },
        { data: { secure_url: "https://cdn.example.com/nested.png" } },
        {},
      ],
    })).toEqual([
      { url: "https://cdn.example.com/photo.jpg", kind: "image" },
      { url: "https://cdn.example.com/clip.webm", kind: "video" },
      { url: "https://cdn.example.com/nested.png", kind: "image" },
    ]);

    expect(getPostMediaItems({ imageUrl: "/a.png", videoUrl: "/b.mp4", image: "/c.png" })).toEqual([
      { url: "/a.png", kind: "image" },
      { url: "/b.mp4", kind: "video" },
      { url: "/c.png", kind: "image" },
    ]);
  });
});

describe("notification, story, and payment helpers", () => {
  it("resolves notification links by deep link or target type", () => {
    expect(resolveNotificationPath({ deepLinkUrl: "/custom" })).toBe("/custom");
    expect(resolveNotificationPath({ targetType: "USER", targetId: 7 })).toBe("/users/7");
    expect(resolveNotificationPath({ targetType: "POST", targetId: 9 })).toBe("/posts/9");
    expect(resolveNotificationPath({ targetType: "COMMENT", targetId: 4 })).toBe("/feed");
    expect(resolveNotificationPath({ targetType: "MESSAGE", targetId: 4 })).toBe("/messages");
    expect(resolveNotificationPath({ targetType: "UNKNOWN", targetId: 1 })).toBeNull();
    expect(resolveNotificationPath({ targetType: "POST" })).toBeNull();
  });

  it("reads story type and views across backend response shapes", () => {
    expect(getStoryMediaType({ mediaTypes: "video" })).toBe("VIDEO");
    expect(getStoryMediaType({ mediaType: "image" })).toBe("IMAGE");
    expect(getStoryViews({ viewsCount: 5 })).toBe(5);
    expect(getStoryViews({ viewCount: 3 })).toBe(3);
    expect(getStoryViews({})).toBe(0);
  });

  it("infers plans and formats INR amounts", () => {
    expect(inferPlanId({ active: false }, [])).toBe("free");
    expect(inferPlanId({ active: true, amount: 49900 }, [])).toBe("premium");
    expect(inferPlanId({ active: true, amount: 149900 }, [])).toBe("business");
    expect(inferPlanId({ active: true, amount: 1 }, [])).toBe("premium");
    expect(inferPlanId({ renewalDue: "2026-06-01" }, [{ amount: 1499 }])).toBe("business");
    expect(formatInrAmount(49900)).toBe("\u20B9499.00");
    expect(formatInrAmount(1499)).toBe("\u20B91499.00");
  });
});
