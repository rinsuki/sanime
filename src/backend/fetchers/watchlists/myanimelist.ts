import got from "got"
import { z } from "zod"

import { UserAnimeStatus, WatchStatus } from "../../../type.js"
import { isNotNull } from "../../../utils/is-not-null.js"
import { redis } from "../../redis.js"
import { registerMalCache, zMalAnime, zMalAnimeFields } from "../animes/myanimelist.js"

const zMyAnimeListStatus = z
    .literal("completed")
    .or(z.literal("watching"))
    .or(z.literal("on_hold"))
    .or(z.literal("dropped"))
    .or(z.literal("plan_to_watch"))

type MyAnimeListStatus = z.infer<typeof zMyAnimeListStatus>

const malToShared: Record<MyAnimeListStatus, WatchStatus> = {
    completed: "WATCHED",
    watching: "WATCHING",
    on_hold: "PAUSED",
    dropped: "DROPPED",
    plan_to_watch: "WANT",
}

const prefix = "sanime:watchlist:mal:v1:"

const zMalAnimeListItem = z.object({
    node: zMalAnime,
    list_status: z.object({
        status: zMyAnimeListStatus,
    }),
})

const zMalUserData = z.object({
    data: z.array(zMalAnimeListItem),
    paging: z.object({
        next: z.string().optional(),
    }),
})

async function fetchMyAnimeListWatchesRaw(username: string) {
    const items: z.infer<typeof zMalAnimeListItem>[] = []
    let nextUrl:
        | string
        | undefined = `https://api.myanimelist.net/v2/users/${username}/animelist?fields=list_status,${zMalAnimeFields
        .map(a => "node." + a)
        .join(",")}&limit=1000`
    while (nextUrl != null) {
        const response = await got<unknown>(nextUrl, {
            headers: {
                "X-MAL-CLIENT-ID": process.env.MAL_CLIENT_ID ?? "",
            },
            responseType: "json",
        })
        console.log(JSON.stringify(response.body, null, 4))
        // if (Math.random() < 5) throw new Error("a")

        const data = zMalUserData.parse(response.body)
        await registerMalCache(data.data.map(item => item.node))
        items.push(...data.data)
        nextUrl = data.paging.next
    }

    return {
        user: {
            name: username,
            picture: undefined,
        },
        items,
    }
}

export async function fetchMyAnimeListWatches(users: string[]): Promise<UserAnimeStatus[]> {
    if (users.length === 0) return []

    const cached = (await redis.mget(users.map(user => prefix + user.toLowerCase())))
        .filter(isNotNull)
        .map(e => JSON.parse(e) as Awaited<ReturnType<typeof fetchMyAnimeListWatchesRaw>>)
    const cachedUsers = new Set(
        cached.map((e: Awaited<ReturnType<typeof fetchMyAnimeListWatchesRaw>>) =>
            e.user.name.toLowerCase(),
        ),
    )

    const userDataList = await Promise.all(
        users
            .filter(u => !cachedUsers.has(u.toLowerCase()))
            .map(u => fetchMyAnimeListWatchesRaw(u)),
    )

    // 3分キャッシュ
    for (const userData of userDataList) {
        await redis.set(
            prefix + userData.user.name.toLowerCase(),
            JSON.stringify(userData),
            "EX",
            60 * 3,
        )
    }

    return [...cached, ...userDataList].map(userData => {
        return {
            id: `mal:${userData.user.name}`,
            avatarUrl: userData.user.picture,
            works: userData.items.map((item: z.infer<typeof zMalAnimeListItem>) => ({
                sourceServiceID: `mal:${item.node.id}`,
                myAnimeListID: item.node.id,
                status: malToShared[item.list_status.status],
            })),
        }
    })
}
