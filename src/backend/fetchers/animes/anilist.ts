import got, { HTTPError } from "got"
import { z } from "zod"

import { AnimeInfo, AnimeType, Season } from "../../../type.js"
import { isNotNull } from "../../../utils/is-not-null.js"
import { FetchContext } from "../../fetch-context.js"
import { redis } from "../../redis.js"

const anilistFormat = [
    "TV",
    "TV_SHORT",
    "MOVIE",
    "SPECIAL",
    "OVA",
    "ONA",
    "MUSIC",
    "MANGA",
    "NOVEL",
    "ONE_SHOT",
] as const

const anilistSeasons = ["WINTER", "SPRING", "SUMMER", "FALL"] as const

const zPrefix = "sanime:anilist:v1:"
const zRes = z.nullable(
    z.object({
        id: z.number(),
        idMal: z.nullable(z.number()),
        title: z.object({
            native: z.nullable(z.string()),
        }),
        season: z.nullable(z.enum(anilistSeasons)),
        seasonYear: z.nullable(z.number()),
        coverImage: z.nullable(
            z.object({
                extraLarge: z.nullable(z.string()),
            }),
        ),
        format: z.nullable(z.enum(anilistFormat)),
    }),
)

const anilistFormatToSharedType: { [key in typeof anilistFormat[number]]: AnimeType } = {
    TV: "TV",
    TV_SHORT: "TV",
    MOVIE: "MOVIE",
    SPECIAL: "OTHERS",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "OTHERS",
    MANGA: "OTHERS",
    NOVEL: "OTHERS",
    ONE_SHOT: "OTHERS",
}

const anilistSeasonToSharedType: { [key in typeof anilistSeasons[number]]: Season } = {
    FALL: "AUTUMN",
    SPRING: "SPRING",
    SUMMER: "SUMMER",
    WINTER: "WINTER",
}

function resToInfo(work: NonNullable<z.infer<typeof zRes>>): AnimeInfo {
    if (work.seasonYear == null && work.season != null) throw new Error("why is seasonYear null?")
    return {
        id: work.idMal != null ? (`mal:${work.idMal}` as const) : (`anilist:${work.id}` as const),
        idMal: work.idMal ?? undefined,
        idAniList: work.id,
        title: work.title.native ?? undefined,
        verticalCoverURL: work.coverImage?.extraLarge ?? undefined,
        type: work.format != null ? anilistFormatToSharedType[work.format] : null,
        season:
            work.seasonYear != null
                ? {
                      year: work.seasonYear,
                      name: work.season != null ? anilistSeasonToSharedType[work.season] : null,
                  }
                : null,
    }
}

const MAX_LENGTH = 50

export async function fetchAniListAnimes(
    fetchContext: FetchContext,
    ids: number[],
    isMyAnimeListIDs: boolean,
    _cacheAlreadyChecked = false,
): Promise<AnimeInfo[]> {
    if (ids.length === 0) return []
    const prefix = `${zPrefix}${isMyAnimeListIDs ? "mal" : "native"}:`
    if (!_cacheAlreadyChecked) {
        const cachedResponses = await redis.mget(ids.map(id => `${prefix}${id}`))
        const notCachedIds = ids.filter((_, i) => cachedResponses[i] == null)
        return [
            ...cachedResponses
                .filter(isNotNull)
                .map(a => JSON.parse(a) as z.infer<typeof zRes>)
                .filter(isNotNull)
                .map(resToInfo),
            ...(await fetchAniListAnimes(fetchContext, notCachedIds, isMyAnimeListIDs, true)),
        ]
    }
    if (ids.length > MAX_LENGTH) {
        const arr = []
        for (let i = 0; i < ids.length; i += MAX_LENGTH) {
            arr.push(
                ...(await fetchAniListAnimes(
                    fetchContext,
                    ids.slice(i, i + MAX_LENGTH),
                    isMyAnimeListIDs,
                    true,
                )),
            )
        }
        return arr
    }

    let query = `query (${ids.map((_, i) => `$w${i}: Int`).join(", ")}) {\n`
    for (const i of ids.keys()) {
        query += `w${i}: Media( ${
            isMyAnimeListIDs ? "idMal" : "id"
        }: $w${i}, type: ANIME ) { ...fields }\n`
    }
    query += "}\n"
    query += "fragment fields on Media {\n"
    query += "id\n"
    query += "idMal\n"
    query += "title { native }\n"
    query += "season\n"
    query += "seasonYear\n"
    query += "coverImage { extraLarge }\n"
    query += "format\n"
    query += "}\n"

    console.log(query)

    interface GraphResponse {
        data: unknown
        errors?: unknown[]
    }

    const res = await got.post<GraphResponse>("https://graphql.anilist.co/", {
        body: JSON.stringify({
            query,
            variables: ids.reduce<Record<string, number>>((obj, id, i) => {
                obj[`w${i}`] = id
                return obj
            }, {}),
        }),
        headers: {
            "Content-Type": "application/json",
        },
        responseType: "json",
        throwHttpErrors: false,
    })
    if (!res.ok && res.statusCode !== 404) {
        if (res.statusCode === 429) {
            console.log("waiting rate limit", res.headers)
            fetchContext.breakIfNeeded(parseInt(res.headers["retry-after"] ?? "1", 10))
            // eslint-disable-next-line no-promise-executor-return
            await new Promise<void>(resolve => setTimeout(resolve, 2000))
            return fetchAniListAnimes(fetchContext, ids, isMyAnimeListIDs, _cacheAlreadyChecked)
        }
        throw new HTTPError(res)
    }

    const errors = res.body.errors
    if (errors != null && errors.length > 0 && errors.length !== ids.length) {
        z.array(
            z.object({
                status: z.literal(404),
            }),
        ).parse(errors)
        // 1つでも存在しないレコードを聞くとすべてのレコードが帰ってこなくなる？w
        // フッフッフw心配することなかれwwこんな時にも役に立つのが競技プログラミング、
        // 伝家の宝刀†二分探索†を使わせていただきますぞ！www
        if (ids.length === 1) throw new Error("Invalid State")
        const sliced = ids.slice(0, ids.length / 2)
        console.log("伝家の宝刀†二分探索†", ids.length, sliced.length)
        return [
            ...(await fetchAniListAnimes(fetchContext, sliced, isMyAnimeListIDs, true)),
            ...(await fetchAniListAnimes(
                fetchContext,
                ids.slice(sliced.length),
                isMyAnimeListIDs,
                true,
            )),
        ]
    }

    const data = z.record(z.string(), zRes).parse(res.body.data)

    await redis.mset(
        Object.fromEntries(ids.map((id, i) => [`${prefix}${id}`, JSON.stringify(data[`w${i}`])])),
    )

    return Object.values(data).filter(isNotNull).map(resToInfo)
}
