import got from "got"
import { z } from "zod"

import { UserAnimeStatus, WatchStatus } from "../../../type.js"
import { isNotNull } from "../../../utils/is-not-null.js"
import { redis } from "../../redis.js"

const mlcFragment = `fragment mlc on MediaListCollection {
    user {
        name
        avatar {
            large
        }
    }
    lists {
        entries {
            status
            media {
                id
                idMal
            }
        }
    }
}`

const zAniListStatus = z
    .literal("CURRENT")
    .or(z.literal("PLANNING"))
    .or(z.literal("COMPLETED"))
    .or(z.literal("DROPPED"))
    .or(z.literal("PAUSED"))
    .or(z.literal("REPEATING"))

type AniListWatchStatus = z.infer<typeof zAniListStatus>

const anilistToShared: Record<AniListWatchStatus, WatchStatus> = {
    REPEATING: "REPEATING",
    COMPLETED: "WATCHED",
    CURRENT: "WATCHING",
    PAUSED: "PAUSED",
    DROPPED: "DROPPED",
    PLANNING: "WANT",
}

const prefix = "sanime:watchlist:anilist:v1:"
const zMlc = z.object({
    user: z.object({
        name: z.string(),
        avatar: z.object({
            large: z.string(),
        }),
    }),
    lists: z.array(
        z.object({
            entries: z.array(
                z.object({
                    status: zAniListStatus,
                    media: z.object({ id: z.number(), idMal: z.nullable(z.number()) }),
                }),
            ),
        }),
    ),
})

async function fetchAniListWatchesRaw(users: string[]): Promise<z.infer<typeof zMlc>[]> {
    if (users.length === 0) return []

    let query = `query (${users.map((_, i) => `$u${i}: String`).join(", ")}) {\n`
    for (const i of users.keys()) {
        query += `u${i}: MediaListCollection(userName: $u${i}, type: ANIME) { ...mlc }\n`
    }
    query += "}\n"
    query += mlcFragment
    console.log(query)

    const anilistRes = await got.post<{ data: unknown }>("https://graphql.anilist.co", {
        body: JSON.stringify({
            query,
            variables: users.reduce<Record<string, string>>((obj, user, i) => {
                obj[`u${i}`] = user
                return obj
            }, {}),
        }),
        headers: {
            "Content-Type": "application/json",
        },
        responseType: "json",
    })

    const data = z.record(z.string(), zMlc).parse(anilistRes.body.data)

    return Object.values(data)
}

export async function fetchAniListWatches(users: string[]): Promise<UserAnimeStatus[]> {
    const cached = (await redis.mget(users.map(user => prefix + user.toLowerCase())))
        .filter(isNotNull)
        .map(e => JSON.parse(e) as z.infer<typeof zMlc>)
    const cachedUser = new Set(cached.map(e => e.user.name.toLowerCase()))

    const mlcs = await fetchAniListWatchesRaw(users.filter(u => !cachedUser.has(u)))

    // 3分キャッシュ
    for (const mlc of mlcs) {
        await redis.set(prefix + mlc.user.name.toLowerCase(), JSON.stringify(mlc), "EX", 60 * 3)
    }

    return [...cached, ...mlcs].map(mlc => {
        return {
            id: `anilist:${mlc.user.name}`,
            avatarUrl: mlc.user.avatar.large,
            works: mlc.lists
                .map(l => l.entries)
                .flat(1)
                .map(e => {
                    return {
                        sourceServiceID: `anilist:${e.media.id}`,
                        myAnimeListID: e.media.idMal ?? undefined,
                        status: anilistToShared[e.status],
                    }
                }),
        }
    })
}
