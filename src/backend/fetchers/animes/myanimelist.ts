import got, { HTTPError } from "got"
import { z } from "zod"

import { AnimeInfo, AnimeType, Season } from "../../../type.js"
import { isNotNull } from "../../../utils/is-not-null.js"
import { redis } from "../../redis.js"

const malFormat = [
    "tv",
    "tv_special",
    "movie",
    "ova",
    "ona",
    "special",
    "music",
    "unknown",
    "pv",
] as const

const malSeasons = ["winter", "spring", "summer", "fall"] as const

const prefix = "sanime:mal:v1:"

export const zMalAnime = z.object({
    id: z.number(),
    title: z.string(),
    main_picture: z
        .object({
            large: z.string(),
        })
        .optional(),
    media_type: z.enum(malFormat).optional(),
    start_season: z
        .object({
            year: z.number(),
            season: z.enum(malSeasons),
        })
        .optional(),
})

export const zMalAnimeFields = Object.keys(zMalAnime.shape)

const malFormatToSharedType: { [key in typeof malFormat[number]]: AnimeType } = {
    tv: "TV",
    tv_special: "TV",
    movie: "MOVIE",
    ova: "OVA",
    ona: "ONA",
    special: "OTHERS",
    music: "OTHERS",
    unknown: "OTHERS",
    pv: "OTHERS",
}

const malSeasonToSharedType: { [key in typeof malSeasons[number]]: Season } = {
    fall: "AUTUMN",
    spring: "SPRING",
    summer: "SUMMER",
    winter: "WINTER",
}

function resToInfo(anime: z.infer<typeof zMalAnime>): AnimeInfo {
    return {
        id: `mal:${anime.id}` as const,
        idMal: anime.id,
        title: anime.title,
        verticalCoverURL: anime.main_picture?.large ?? undefined,
        type: anime.media_type ? malFormatToSharedType[anime.media_type] : null,
        season: anime.start_season
            ? {
                  year: anime.start_season.year,
                  name: malSeasonToSharedType[anime.start_season.season],
              }
            : null,
    }
}

export async function registerMalCache(animes: z.infer<typeof zMalAnime>[]) {
    await redis.mset(
        animes.flatMap(anime => {
            return [`${prefix}${anime.id}`, JSON.stringify(anime)] as const
        }),
    )
}

export async function fetchMyAnimeListAnimes(ids: number[]): Promise<AnimeInfo[]> {
    if (ids.length === 0) return []

    // キャッシュをチェック
    const cachedResponses = await redis.mget(ids.map(id => `${prefix}${id}`))
    const notCachedIds = ids.filter((_, i) => cachedResponses[i] == null)

    const cachedAnimes = cachedResponses
        .filter(isNotNull)
        .map((a: string) => JSON.parse(a) as z.infer<typeof zMalAnime>)
        .map(resToInfo)

    if (notCachedIds.length === 0) return cachedAnimes

    // 新しいデータを取得
    const responses: (z.infer<typeof zMalAnime> | null)[] = []
    for (const id of notCachedIds) {
        try {
            const response = await got<unknown>(`https://api.myanimelist.net/v2/anime/${id}`, {
                headers: {
                    "X-MAL-CLIENT-ID": process.env.MAL_CLIENT_ID ?? "",
                },
                searchParams: {
                    fields: zMalAnimeFields.join(","),
                },
                responseType: "json",
            })
            const data = zMalAnime.parse(response.body)
            // 1時間キャッシュ
            await registerMalCache([data])
            responses.push(data)
        } catch (error) {
            if (error instanceof HTTPError && error.response.statusCode === 404) {
                responses.push(null)
            } else {
                throw error
            }
        }
    }

    return [...cachedAnimes, ...responses.filter(isNotNull).map(resToInfo)]
}
