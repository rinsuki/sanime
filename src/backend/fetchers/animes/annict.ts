import got from "got"
import { z } from "zod"

import { AnimeInfo, AnimeType } from "../../../type.js"
import { isNotNull } from "../../../utils/is-not-null.js"
import { redis } from "../../redis.js"

const annictMedia = ["TV", "OVA", "MOVIE", "WEB", "OTHER"] as const

const zWork = z.object({
    annictId: z.number(),
    title: z.string(),
    malAnimeId: z.nullable(z.string()),
    seasonName: z.nullable(z.enum(["WINTER", "SPRING", "SUMMER", "AUTUMN"])),
    seasonYear: z.nullable(z.number()),
    image: z.nullable(
        z.object({
            facebookOgImageUrl: z.nullable(z.string()),
        }),
    ),
    media: z.nullable(z.enum(annictMedia)),
})

const annictMediaToSharedType: { [key in typeof annictMedia[number]]: AnimeType } = {
    TV: "TV",
    OVA: "OVA",
    MOVIE: "MOVIE",
    WEB: "ONA",
    OTHER: "OTHERS",
}

const prefix = "sanime:annict:v1:"

export function resToInfo(work: z.infer<typeof zWork>): AnimeInfo {
    if (work.seasonYear == null && work.seasonName != null)
        throw new Error("why is seasonYear null?")
    return {
        id:
            work.malAnimeId != null
                ? (`mal:${work.malAnimeId}` as const)
                : (`annict:${work.annictId}` as const),
        idMal: work.malAnimeId != null ? parseInt(work.malAnimeId, 10) : undefined,
        idAnnict: work.annictId,
        title: work.title,
        horizontalCoverURL: work.image?.facebookOgImageUrl ?? undefined,
        type: work.media != null ? annictMediaToSharedType[work.media] : null,
        season:
            work.seasonYear != null
                ? {
                      year: work.seasonYear,
                      name: work.seasonName,
                  }
                : null,
    }
}

export async function fetchAnnictAnimes(
    annictIds: number[],
    _cacheAlreadyChecked = false,
): Promise<AnimeInfo[]> {
    // first check cache
    if (!_cacheAlreadyChecked) {
        const cachedResponses = await redis.mget(annictIds.map(id => `${prefix}${id}`))
        const notCachedIds = annictIds.filter((_, i) => cachedResponses[i] == null)
        return [
            ...cachedResponses
                .filter(isNotNull)
                .map(a => JSON.parse(a) as z.infer<typeof zWork>)
                .filter(isNotNull)
                .map(resToInfo),
            ...(await fetchAnnictAnimes(notCachedIds, true)),
        ]
    }
    if (annictIds.length > 50) {
        const arr = []
        for (let i = 0; i < annictIds.length; i += 50) {
            arr.push(...(await fetchAnnictAnimes(annictIds.slice(i, i + 50), true)))
        }
        return arr
    }
    if (annictIds.length === 0) return []

    let query = "query ($ids: [Int!]) { works: searchWorks( annictIds: $ids ) { nodes {\n"
    query += "annictId\n"
    query += "title\n"
    query += "malAnimeId\n"
    query += "seasonName\n"
    query += "seasonYear\n"
    query += "image { facebookOgImageUrl }\n"
    query += "media\n"
    query += "} } }"

    const res = await got.post<{ data: unknown }>("https://api.annict.com/graphql", {
        body: JSON.stringify({
            query,
            variables: {
                ids: annictIds,
            },
        }),
        headers: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            "Authorization": `Bearer ${process.env.ANNICT_TOKEN!}`,
            "Content-Type": "application/json",
        },
        responseType: "json",
    })

    console.log(res.body)

    const data = z
        .object({
            works: z.object({
                nodes: z.array(zWork),
            }),
        })
        .parse(res.body.data)

    const works = data.works.nodes
    if (works.length < 1) return []
    await redis.mset(
        Object.fromEntries(works.map(work => [`${prefix}${work.annictId}`, JSON.stringify(work)])),
    )

    return works.map(resToInfo)
}
