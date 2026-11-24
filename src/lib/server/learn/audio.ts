import "server-only";
import { createHash } from "crypto";

/** Id of the pre-made audio file for an English text (public/audio/<id>.mp3). Same rule as scripts/course/tts.py. */
export const audioId = (text: string) => createHash("sha1").update(text.trim().toLowerCase()).digest("hex").slice(0, 12);
