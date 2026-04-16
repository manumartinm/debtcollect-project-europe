import { Hono } from "hono"
import { AccessToken, RoomConfiguration } from "livekit-server-sdk"

export const tokenRoutes = new Hono()

tokenRoutes.post("/", async (c) => {
  const livekitApiKey = process.env.LIVEKIT_API_KEY!
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET!
  const livekitUrl = process.env.LIVEKIT_URL!
  const body = await c.req.json()

  const sessionId = crypto.randomUUID()
  const room = body.room_name ?? `session-${sessionId}`
  const identity = body.participant_identity ?? `user-${sessionId}`
  const name = body.participant_name ?? "user"
  const metadata = body.participant_metadata ?? ""
  const attributes = body.participant_attributes ?? {}

  const accessToken = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity,
    name,
    metadata,
    attributes,
    ttl: "10m",
  })

  accessToken.addGrant({ room, roomJoin: true })

  if (body.room_config) {
    accessToken.roomConfig = RoomConfiguration.fromJson(body.room_config)
  }

  const participantToken = await accessToken.toJwt()

  return c.json(
    {
      server_url: livekitUrl,
      participant_token: participantToken,
    },
    201
  )
})
