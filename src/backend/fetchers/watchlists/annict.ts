import got from "got"
import z from "zod"

import { AnimeStatus, UserAnimeStatus, WatchStatus } from "../../../type.js"
import { isNotNull } from "../../../utils/is-not-null.js"
import { redis } from "../../redis.js"

const zAnnictWatchStatus = z
    .literal("WANNA_WATCH")
    .or(z.literal("WATCHING"))
    .or(z.literal("WATCHED"))
    .or(z.literal("ON_HOLD"))
    .or(z.literal("STOP_WATCHING"))

type AnnictWatchStatus = z.infer<typeof zAnnictWatchStatus>

const annictToShared: Record<AnnictWatchStatus, WatchStatus> = {
    WANNA_WATCH: "WANT",
    WATCHING: "WATCHING",
    WATCHED: "WATCHED",
    ON_HOLD: "PAUSED",
    STOP_WATCHING: "DROPPED",
}

const ANNICT_WATCH_STATUS = Object.keys(annictToShared) as AnnictWatchStatus[]

const zAnnictWorks = z.object({
    nodes: z.array(
        z.object({
            annictId: z.number(),
            malAnimeId: z.nullable(z.string()),
        }),
    ),
})

function generateZAnnictUserWorks() {
    const obj: Partial<Record<AnnictWatchStatus, undefined | typeof zAnnictWorks>> = {}
    for (const status of ANNICT_WATCH_STATUS) {
        obj[status] = zAnnictWorks
    }

    return obj as Record<AnnictWatchStatus, typeof zAnnictWorks>
}

const prefix = "sanime:watchlist:annict:v1:"
const zAnnictUser = z.object({
    username: z.string(),
    avatarUrl: z.string(),
    ...generateZAnnictUserWorks(),
})

async function fetchAnnictWatchesRaw(users: string[]): Promise<z.infer<typeof zAnnictUser>[]> {
    if (users.length === 0) return []

    let query = `query (${users.map((_, i) => `$u${i}: String!`).join(", ")}) {\n`
    for (const i of users.keys()) {
        query += `u${i}: user(username: $u${i}) { ...userObj }\n`
    }
    query += "}\n"
    query += "fragment userObj on User {\n"
    query += "username\n"
    query += "avatarUrl\n"
    for (const state of ANNICT_WATCH_STATUS) {
        query += `${state}: works(state: ${state}) { nodes { ...workIds } }\n`
    }
    query += "}\n"
    query += "fragment workIds on Work {\nannictId\nmalAnimeId\n}"
    console.log(query)
    const annictRes = await got.post<{ data: unknown }>("https://api.annict.com/graphql", {
        body: JSON.stringify({
            query,
            variables: users.reduce<Record<string, string>>((obj, user, i) => {
                obj[`u${i}`] = user
                return obj
            }, {}),
        }),
        headers: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            "Authorization": `Bearer ${process.env.ANNICT_TOKEN!}`,
            "Content-Type": "application/json",
        },
        responseType: "json",
    })

    const data = z.record(z.string(), zAnnictUser).parse(annictRes.body.data)
    return Object.values(data)
}

export async function fetchAnnictWatches(users: string[]): Promise<UserAnimeStatus[]> {
    const cached = (await redis.mget(users.map(user => prefix + user.toLowerCase())))
        .filter(isNotNull)
        .map(e => JSON.parse(e) as z.infer<typeof zAnnictUser>)
    const cachedUser = new Set(cached.map(e => e.username.toLowerCase()))

    const fetchedUsers = await fetchAnnictWatchesRaw(users.filter(u => !cachedUser.has(u)))
    // 3分キャッシュ
    for (const fetchedUser of fetchedUsers) {
        await redis.set(
            prefix + fetchedUser.username.toLowerCase(),
            JSON.stringify(fetchedUser),
            "EX",
            60 * 3,
        )
    }

    return [...cached, ...fetchedUsers].map(user => {
        return {
            id: `annict:${user.username}`,
            avatarUrl: user.avatarUrl,
            works: ANNICT_WATCH_STATUS.reduce<AnimeStatus[]>(
                (works, key) => [
                    ...works,
                    ...user[key].nodes.map(work => {
                        const myAnimeListID =
                            work.malAnimeId == null ? undefined : parseInt(work.malAnimeId, 10)
                        return {
                            sourceServiceID: `annict:${work.annictId}` as const,
                            myAnimeListID,
                            status: annictToShared[key],
                        }
                    }),
                ],
                [],
            ),
        }
    })
}
