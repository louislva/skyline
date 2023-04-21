import { getDB } from "@/helpers/db";
const { db } = getDB();

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "POST") {
      const { config, created_by_handle } = req.body;

      if (typeof config !== "object") return res.status(400).end();
      if (typeof created_by_handle !== "string") return res.status(400).end();
      const key = `${Math.random().toString(36).substring(2, 7)}`;

      await db.one(
        `INSERT INTO shared_custom_timeline (key, config, created_by_handle) VALUES ($/key/, $/config/, $/created_by_handle/) RETURNING *`,
        {
          key,
          config,
          created_by_handle,
        }
      );
      res.status(200).json({ key });
    } else if (req.method === "GET") {
      const key = req.query.key;
      if (typeof key !== "string") return res.status(400).end();
      const result = await db.one(
        `SELECT config, created_by_handle FROM shared_custom_timeline WHERE key = $/key/`,
        {
          key,
        }
      );
      await db.one(
        `UPDATE shared_custom_timeline SET installs = installs + 1 WHERE key = $/key/ RETURNING *`,
        {
          key,
        }
      );
      res.status(200).json(result);
    } else {
      return res.status(405).end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
}
