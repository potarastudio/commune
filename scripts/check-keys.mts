import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { Resend } from "resend";

const url = process.env.LIVEKIT_URL!, key = process.env.LIVEKIT_API_KEY!, secret = process.env.LIVEKIT_API_SECRET!;
console.log("LiveKit key id:", key, "secret length:", secret.length);
const at = new AccessToken(key, secret, { identity: "check", ttl: 60 });
at.addGrant({ roomJoin: true, room: "check-room" });
const jwt = await at.toJwt();
console.log("token minted:", jwt.split(".").length === 3 ? "ok" : "bad");
const svc = new RoomServiceClient(url.replace(/^wss?/, "https"), key, secret);
try {
  const rooms = await svc.listRooms();
  console.log("LiveKit API auth: ok, live rooms:", rooms.length);
} catch (e) { console.log("LiveKit API auth FAILED:", (e as Error).message); }

const resend = new Resend(process.env.RESEND_API_KEY!);
const { data, error } = await resend.domains.list();
if (error) console.log("Resend key FAILED:", error.message);
else console.log("Resend key: ok, domains:", data?.data.map((d) => `${d.name} (${d.status})`).join(", "));
console.log("RESEND_FROM:", process.env.RESEND_FROM);
