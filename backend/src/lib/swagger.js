export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "DevChat API",
    version: "1.0.0",
    description:
      "Real-time messaging API. Auth is a JWT stored in an httpOnly `jwt` cookie, " +
      "set on signup/login and sent automatically by the browser.",
  },
  servers: [{ url: "/", description: "current host" }],
  tags: [
    { name: "Auth" },
    { name: "Messages" },
    { name: "System" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "jwt" },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          _id: { type: "string", example: "665f1c2a9b1e4a0012abcd34" },
          fullName: { type: "string", example: "Jane Doe" },
          email: { type: "string", format: "email", example: "jane@example.com" },
          profilePic: { type: "string", example: "https://res.cloudinary.com/.../pic.jpg" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Message: {
        type: "object",
        properties: {
          _id: { type: "string" },
          senderId: { type: "string" },
          receiverId: { type: "string" },
          text: { type: "string", example: "hey there" },
          image: { type: "string", example: "https://res.cloudinary.com/.../img.jpg" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: { message: { type: "string", example: "Internal Server Error" } },
      },
    },
  },
  paths: {
    "/api/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email", "password"],
                properties: {
                  fullName: { type: "string", example: "Jane Doe" },
                  email: { type: "string", format: "email", example: "jane@example.com" },
                  password: { type: "string", minLength: 6, example: "secret123" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Account created; sets the jwt cookie", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          400: { description: "Validation error or email already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Logged in; sets the jwt cookie", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          400: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          429: { description: "Too many attempts (rate limited)" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out (clears the jwt cookie)",
        responses: { 200: { description: "Logged out" } },
      },
    },
    "/api/auth/check": {
      get: {
        tags: ["Auth"],
        summary: "Get the current authenticated user",
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: "Current user", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/api/auth/update-profile": {
      put: {
        tags: ["Auth"],
        summary: "Update profile picture",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["profilePic"],
                properties: { profilePic: { type: "string", description: "base64 data URL or image URL", example: "data:image/png;base64,iVBOR..." } },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated user", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          400: { description: "Profile pic is required" },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/api/messages/users": {
      get: {
        tags: ["Messages"],
        summary: "List users for the sidebar (everyone except me)",
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: "Up to 100 users", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/User" } } } } },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/api/messages/{id}": {
      get: {
        tags: ["Messages"],
        summary: "Get the conversation with a user (cursor paginated)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "the other user's id" },
          { name: "cursor", in: "query", required: false, schema: { type: "string", format: "date-time" }, description: "createdAt of the oldest message you have; returns older ones" },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 30, maximum: 100 } },
        ],
        responses: {
          200: {
            description: "A page of messages, oldest → newest",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    messages: { type: "array", items: { $ref: "#/components/schemas/Message" } },
                    nextCursor: { type: "string", format: "date-time", nullable: true },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/api/messages/send/{id}": {
      post: {
        tags: ["Messages"],
        summary: "Send a message to a user (also delivered live over Socket.IO)",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "the receiver's id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  text: { type: "string", example: "hello" },
                  image: { type: "string", description: "base64 data URL; uploaded to Cloudinary" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created message", content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } } },
          400: { description: "Message cannot be empty" },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/health": {
      get: { tags: ["System"], summary: "Liveness probe", responses: { 200: { description: "ok" } } },
    },
    "/ready": {
      get: { tags: ["System"], summary: "Readiness probe (checks the DB)", responses: { 200: { description: "ready" }, 503: { description: "not ready" } } },
    },
  },
};
