import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/core/api/client", () => ({
  apiRequest: vi.fn(),
}));

import { SettingsRow } from "../src/components/settings/SettingsRow";
import { chatRequest } from "../src/core/api/chat";
import { apiRequest } from "../src/core/api/client";

describe("chat API boundary", () => {
  it("sends chat requests through the shared API client", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true } as any);

    await chatRequest({
      messages: [{ role: "user", content: "Hello" }],
      userLocalTime: "morning",
      userTimeOfDay: "day",
    });

    expect(apiRequest).toHaveBeenCalledWith("/chat", {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "Hello" }],
        userLocalTime: "morning",
        userTimeOfDay: "day",
      },
    });
  });
});

describe("settings row semantics", () => {
  it("uses a non-button wrapper when a row contains a switch", () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsRow, {
        icon: null,
        label: "Dark mode",
        trailing: React.createElement("input", { type: "checkbox", "aria-label": "Dark mode" }),
      }),
    );

    expect(html).not.toContain("<button");
    expect(html).toContain("Dark mode");
  });
});
