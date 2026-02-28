export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Bun Auth API",
    version: "1.0.0",
    description: "Production-ready Auth API with Bun.js + MySQL",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "integer" },
          full_name: { type: "string" },
          username: { type: "string" },
          phone_number: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/api/auth/signup": {
      post: {
        summary: "Register a new user",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone_number", "full_name", "username", "password"],
                properties: {
                  phone_number: { type: "string" },
                  full_name: { type: "string" },
                  username: { type: "string" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "User created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        user: { $ref: "#/components/schemas/User" },
                        access_token: { type: "string" },
                        refresh_token: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Login a user",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone_number", "password"],
                properties: {
                  phone_number: { type: "string" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
          },
          401: {
            description: "Invalid credentials",
          },
        },
      },
    },
    "/api/me": {
      get: {
        summary: "Get current user profile",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          200: {
            description: "OK",
          },
        },
      },
    },
  },
};

export const scalarHtml = (specUrl: string) => `
<!doctype html>
<html>
  <head>
    <title>API Reference</title>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${specUrl}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>
`;
