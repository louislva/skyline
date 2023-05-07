import { getDB } from "@/helpers/db";
import { BskyAgent } from "@atproto/api";
const { db } = getDB();

export default async function handler(req: any, res: any) {
  if (req.method === "POST") {
    const { config, session } = req.body;

    console.log({ config, session });

    if (typeof config !== "object") return res.status(400).end();
    if (typeof session !== "object") return res.status(400).end();

    // First, check session
    const agent = new BskyAgent({
      service: "https://bsky.social",
    });
    const authVerified = await agent
      .resumeSession(session)
      .then(() => true)
      .catch(() => false);
    if (!authVerified) return res.status(401).end();

    // Then, update the DB
    let user = await db.oneOrNone(`SELECT * FROM "user" WHERE did = $/did/`, {
      did: session?.did,
    });
    if (!user) {
      user = await db.one(
        `INSERT INTO "user" (did, handle, config) VALUES ($/did/, $/handle/, $/config/) RETURNING *`,
        { did: session?.did, handle: session?.handle, config: config }
      );
    } else {
      // Now, update it
      user = await db.one(
        `UPDATE "user" SET config = $/config/ WHERE did = $/did/ RETURNING *`,
        {
          did: session?.did,
          config: {
            ...user.config,
            ...config,
          },
        }
      );
    }
    await db.one(
      `INSERT INTO "user_visit" ("user", posted_config) VALUES ($/user/, $/posted_config/) RETURNING *`,
      { user: user.id, posted_config: config }
    );

    res.status(200).json({
      config: user.config,
    });
  } else {
    return res.status(405).end();
  }
}
