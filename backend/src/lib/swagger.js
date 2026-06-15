// Hand-maintained OpenAPI spec. Keep in sync when routes change.
const ID = { type: "string", example: "665f1c2a9b1e4a0012abcd34" };
const json = (schema) => ({ "application/json": { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (name) => ({ type: "array", items: ref(name) });
const ok = (desc, schema) => ({ description: desc, ...(schema ? { content: json(schema) } : {}) });
const auth = [{ cookieAuth: [] }];

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "DevChat API",
    version: "1.0.0",
    description:
      "Real-time messaging API. Auth is a JWT in an httpOnly `jwt` cookie, set on signup/login. " +
      "Most realtime behaviour (delivery, typing, presence, read/delivered receipts, edits) happens over Socket.IO.",
  },
  servers: [{ url: "/", description: "current host" }],
  tags: [
    { name: "Auth" },
    { name: "Account" },
    { name: "Users" },
    { name: "Messages" },
    { name: "Conversations" },
    { name: "Moderation" },
    { name: "System" },
  ],
  components: {
    securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: "jwt" } },
    schemas: {
      User: {
        type: "object",
        properties: {
          _id: ID,
          fullName: { type: "string", example: "Jane Doe" },
          email: { type: "string", format: "email" },
          username: { type: "string", example: "jane_99", nullable: true },
          profilePic: { type: "string" },
          bio: { type: "string", nullable: true },
          status: { type: "string", nullable: true },
          lastSeen: { type: "string", format: "date-time", nullable: true },
          isAdmin: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Reaction: {
        type: "object",
        properties: { userId: ID, emoji: { type: "string", example: "👍" } },
      },
      Message: {
        type: "object",
        properties: {
          _id: ID,
          conversationId: ID,
          senderId: ID,
          receiverId: { ...ID, nullable: true, description: "absent for group messages" },
          text: { type: "string", nullable: true },
          image: { type: "string", nullable: true },
          audio: { type: "string", nullable: true, description: "mp3 url" },
          mentions: { type: "array", items: ID },
          replyTo: { oneOf: [ID, ref("Message")], nullable: true },
          forwardedFrom: { ...ID, nullable: true },
          reactions: arrayOf("Reaction"),
          starredBy: { type: "array", items: ID },
          deliveredAt: { type: "string", format: "date-time", nullable: true },
          readAt: { type: "string", format: "date-time", nullable: true },
          editedAt: { type: "string", format: "date-time", nullable: true },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          pinnedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      MessagePage: {
        type: "object",
        properties: {
          messages: arrayOf("Message"),
          nextCursor: { type: "string", format: "date-time", nullable: true },
        },
      },
      Conversation: {
        type: "object",
        properties: {
          _id: ID,
          isGroup: { type: "boolean" },
          name: { type: "string", nullable: true },
          participants: arrayOf("User"),
          admins: { type: "array", items: ID },
          lastMessage: ref("Message"),
          lastMessageAt: { type: "string", format: "date-time", nullable: true },
          unread: { type: "integer" },
          isMuted: { type: "boolean" },
          isArchived: { type: "boolean" },
          isAdmin: { type: "boolean" },
        },
      },
      Report: {
        type: "object",
        properties: {
          _id: ID,
          reporterId: ref("User"),
          messageId: ref("Message"),
          reason: { type: "string" },
          status: { type: "string", enum: ["open", "resolved", "dismissed"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: { type: "object", properties: { message: { type: "string" } } },
    },
  },
  paths: {
    // ---------- Auth ----------
    "/api/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create an account (sets jwt cookie)",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["fullName", "email", "password"],
            properties: {
              fullName: { type: "string" },
              email: { type: "string", format: "email" },
              password: { type: "string", minLength: 6 },
              username: { type: "string", description: "3-20 chars: a-z, 0-9, _" },
            },
          }),
        },
        responses: {
          201: ok("Created", ref("User")),
          400: ok("Validation error / email exists", ref("Error")),
          409: ok("Username taken", ref("Error")),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in (sets jwt cookie)",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["email", "password"],
            properties: { email: { type: "string" }, password: { type: "string" } },
          }),
        },
        responses: { 200: ok("Logged in", ref("User")), 400: ok("Invalid credentials", ref("Error")), 429: ok("Rate limited") },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], summary: "Log out (clears cookie)", responses: { 200: ok("Logged out") } },
    },
    "/api/auth/check": {
      get: {
        tags: ["Auth"],
        summary: "Current authenticated user",
        security: auth,
        responses: { 200: ok("Current user", ref("User")), 401: ok("Not authenticated") },
      },
    },
    "/api/auth/check-username": {
      get: {
        tags: ["Auth"],
        summary: "Check username availability (public)",
        parameters: [{ name: "username", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          200: ok("Availability", {
            type: "object",
            properties: { available: { type: "boolean" }, reason: { type: "string" } },
          }),
        },
      },
    },
    // ---------- Account ----------
    "/api/auth/update-profile": {
      put: {
        tags: ["Account"],
        summary: "Update profile (pic / username / bio / status)",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              profilePic: { type: "string", description: "base64 data URL" },
              username: { type: "string" },
              bio: { type: "string", maxLength: 200 },
              status: { type: "string", maxLength: 80 },
            },
          }),
        },
        responses: {
          200: ok("Updated user", ref("User")),
          409: ok("Username taken", ref("Error")),
          502: ok("Image upload failed", ref("Error")),
        },
      },
    },
    "/api/auth/change-password": {
      post: {
        tags: ["Account"],
        summary: "Change password (also logs out other devices)",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["currentPassword", "newPassword"],
            properties: { currentPassword: { type: "string" }, newPassword: { type: "string", minLength: 6 } },
          }),
        },
        responses: { 200: ok("Changed"), 400: ok("Wrong current password", ref("Error")) },
      },
    },
    "/api/auth/logout-all": {
      post: {
        tags: ["Account"],
        summary: "Log out of all other devices (bumps tokenVersion)",
        security: auth,
        responses: { 200: ok("Done") },
      },
    },
    "/api/auth/me": {
      delete: {
        tags: ["Account"],
        summary: "Delete account (and the user's messages/DMs)",
        security: auth,
        responses: { 200: ok("Deleted") },
      },
    },
    "/api/auth/block/{id}": {
      post: {
        tags: ["Account"],
        summary: "Block / unblock a user (toggle)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: ok("Updated block list", {
            type: "object",
            properties: { blockedUsers: { type: "array", items: ID } },
          }),
        },
      },
    },
    // ---------- Users ----------
    "/api/messages/users": {
      get: {
        tags: ["Users"],
        summary: "Your contacts (people you've messaged)",
        security: auth,
        responses: { 200: ok("Contacts", arrayOf("User")) },
      },
    },
    "/api/messages/users/search": {
      get: {
        tags: ["Users"],
        summary: "Search any user by username or name",
        security: auth,
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Matches", arrayOf("User")) },
      },
    },
    // ---------- Messages ----------
    "/api/messages/conversations": {
      get: {
        tags: ["Conversations"],
        summary: "Your conversations (groups + DMs) with unread/mute/archive state",
        security: auth,
        responses: { 200: ok("Conversations", arrayOf("Conversation")) },
      },
    },
    "/api/messages/search": {
      get: {
        tags: ["Messages"],
        summary: "Search messages (optionally within one DM)",
        security: auth,
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "with", in: "query", required: false, schema: { type: "string" }, description: "peer user id" },
        ],
        responses: { 200: ok("Matches", arrayOf("Message")) },
      },
    },
    "/api/messages/starred": {
      get: {
        tags: ["Messages"],
        summary: "Your starred messages",
        security: auth,
        responses: { 200: ok("Starred", arrayOf("Message")) },
      },
    },
    "/api/messages/{id}": {
      get: {
        tags: ["Messages"],
        summary: "DM history with a user (cursor paginated)",
        security: auth,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "peer user id" },
          { name: "cursor", in: "query", required: false, schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 30, maximum: 100 } },
        ],
        responses: { 200: ok("A page of messages", ref("MessagePage")), 401: ok("Not authenticated") },
      },
    },
    "/api/messages/send/{id}": {
      post: {
        tags: ["Messages"],
        summary: "Send a DM (also delivered live over Socket.IO)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "receiver id" }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              text: { type: "string" },
              image: { type: "string", description: "base64 data URL" },
              audio: { type: "string", description: "base64 data URL (transcoded to mp3)" },
              replyTo: { type: "string", description: "message id being replied to" },
            },
          }),
        },
        responses: {
          201: ok("Created message", ref("Message")),
          400: ok("Empty message", ref("Error")),
          403: ok("Blocked", ref("Error")),
        },
      },
    },
    "/api/messages/{messageId}": {
      patch: {
        tags: ["Messages"],
        summary: "Edit a message (sender only, within 10 minutes)",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["text"], properties: { text: { type: "string" } } }) },
        responses: { 200: ok("Updated", ref("Message")), 403: ok("Not owner / window expired", ref("Error")) },
      },
      delete: {
        tags: ["Messages"],
        summary: "Delete a message (sender only, within 10 minutes; soft delete)",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Soft-deleted", ref("Message")), 403: ok("Not owner / window expired", ref("Error")) },
      },
    },
    "/api/messages/{messageId}/react": {
      post: {
        tags: ["Messages"],
        summary: "Toggle an emoji reaction",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["emoji"], properties: { emoji: { type: "string" } } }) },
        responses: { 200: ok("Updated", ref("Message")) },
      },
    },
    "/api/messages/{messageId}/pin": {
      post: {
        tags: ["Messages"],
        summary: "Toggle pin on a message",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Updated", ref("Message")) },
      },
    },
    "/api/messages/{messageId}/star": {
      post: {
        tags: ["Messages"],
        summary: "Toggle star (bookmark) on a message",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Star state", { type: "object", properties: { starred: { type: "boolean" } } }) },
      },
    },
    "/api/messages/{messageId}/forward": {
      post: {
        tags: ["Messages"],
        summary: "Forward a message to another user",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["to"], properties: { to: { type: "string", description: "recipient user id" } } }) },
        responses: { 201: ok("Forwarded message", ref("Message")) },
      },
    },
    "/api/messages/{messageId}/report": {
      post: {
        tags: ["Moderation"],
        summary: "Report a message",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["reason"], properties: { reason: { type: "string" } } }) },
        responses: { 201: ok("Reported") },
      },
    },
    // ---------- Conversations / groups ----------
    "/api/messages/group": {
      post: {
        tags: ["Conversations"],
        summary: "Create a group",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["name", "members"],
            properties: { name: { type: "string" }, members: { type: "array", items: ID } },
          }),
        },
        responses: { 201: ok("Created group", ref("Conversation")) },
      },
    },
    "/api/messages/conversation/{conversationId}": {
      get: {
        tags: ["Conversations"],
        summary: "Conversation messages (group or DM, cursor paginated)",
        security: auth,
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } },
          { name: "cursor", in: "query", required: false, schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 30 } },
        ],
        responses: { 200: ok("A page of messages", ref("MessagePage")), 403: ok("Not a participant") },
      },
      post: {
        tags: ["Conversations"],
        summary: "Send a message to a conversation (group)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              text: { type: "string" },
              image: { type: "string" },
              audio: { type: "string" },
              replyTo: { type: "string" },
            },
          }),
        },
        responses: { 201: ok("Created message", ref("Message")), 403: ok("Not a participant") },
      },
      patch: {
        tags: ["Conversations"],
        summary: "Rename a group (admins only)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["name"], properties: { name: { type: "string" } } }) },
        responses: { 200: ok("Renamed", ref("Conversation")), 403: ok("Admins only") },
      },
    },
    "/api/messages/conversation/{conversationId}/mute": {
      post: {
        tags: ["Conversations"],
        summary: "Toggle mute for the current user",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Mute state", { type: "object", properties: { isMuted: { type: "boolean" } } }) },
      },
    },
    "/api/messages/conversation/{conversationId}/archive": {
      post: {
        tags: ["Conversations"],
        summary: "Toggle archive for the current user",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Archive state", { type: "object", properties: { isArchived: { type: "boolean" } } }) },
      },
    },
    "/api/messages/conversation/{conversationId}/members": {
      post: {
        tags: ["Conversations"],
        summary: "Add members to a group (admins only)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["members"], properties: { members: { type: "array", items: ID } } }) },
        responses: { 200: ok("Updated group", ref("Conversation")), 403: ok("Admins only") },
      },
    },
    "/api/messages/conversation/{conversationId}/members/{userId}": {
      delete: {
        tags: ["Conversations"],
        summary: "Remove a member (admins only)",
        security: auth,
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } },
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: ok("Removed"), 403: ok("Admins only") },
      },
    },
    "/api/messages/conversation/{conversationId}/leave": {
      post: {
        tags: ["Conversations"],
        summary: "Leave a group",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Left") },
      },
    },
    // ---------- Moderation (admin) ----------
    "/api/admin/reports": {
      get: {
        tags: ["Moderation"],
        summary: "List reports (admin only)",
        security: auth,
        parameters: [{ name: "status", in: "query", required: false, schema: { type: "string", enum: ["open", "resolved", "dismissed", "all"] } }],
        responses: { 200: ok("Reports", arrayOf("Report")), 403: ok("Admin only") },
      },
    },
    "/api/admin/reports/{reportId}": {
      patch: {
        tags: ["Moderation"],
        summary: "Resolve or dismiss a report (admin only)",
        security: auth,
        parameters: [{ name: "reportId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["status"], properties: { status: { type: "string", enum: ["resolved", "dismissed"] } } }) },
        responses: { 200: ok("Updated report", ref("Report")), 403: ok("Admin only") },
      },
    },
    // ---------- System ----------
    "/health": { get: { tags: ["System"], summary: "Liveness probe", responses: { 200: ok("ok") } } },
    "/ready": { get: { tags: ["System"], summary: "Readiness probe (checks DB)", responses: { 200: ok("ready"), 503: ok("not ready") } } },
    "/metrics": { get: { tags: ["System"], summary: "Prometheus metrics", responses: { 200: ok("Prometheus text format") } } },
  },
};
