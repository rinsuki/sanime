// 上の方が強い
export const WATCH_STATUS = [
    "REPEATING", // 再視聴中
    "WATCHED", // 視聴完了
    "WATCHING", // 視聴中
    "PAUSED", // 一時中断中
    "WANT", // 視聴したい
    "DROPPED", // 視聴断念
] as const

export function statusScore(status: WatchStatus, season: SeasonStruct | undefined | null) {
    if (status === "DROPPED") {
        return -1
    } else if (
        status === "REPEATING" ||
        status === "WATCHED" ||
        (status === "WATCHING" && season != null && isNearCurrentOrAfterSeason(season))
    ) {
        return 10
    } else {
        return WATCH_STATUS.length - WATCH_STATUS.indexOf(status) - 1
    }
}

export interface SeasonStruct {
    year: number
    name: Season | null
}

/**
 * だいたい今期以降のシーズンかを判定する。
 * watchingをwatched判定として扱うかに利用する
 */
export function isNearCurrentOrAfterSeason(season: SeasonStruct) {
    let month: number
    switch (season.name) {
        case null:
            month = 1
            break
        case "WINTER":
            month = 1
            break
        case "SPRING":
            month = 4
            break
        case "SUMMER":
            month = 7
            break
        case "AUTUMN":
            month = 11
            break
    }
    if (month == null) throw new Error("never happened!")
    month-- // JavaScript Date's month is 0-indexed
    // ひょっとするとフライングするアニメもあるかもしれないので2週間くらい早めに判定しておく
    const startDate = new Date(season.year, month, -14)
    const endDate = new Date(
        season.year,
        // シーズン名が指定されていなかったら1年中あるものだということにする
        // TODO: 連続2クールのことをちゃんと考える (でもシーズン情報だけだとどうしようもない？)
        season.name == null ? 11 : month + 3,
        // いろいろなことがあって次シーズンに被ることがあるので、だいたい2週間くらいは多めに見る
        // 例: 式守さんは2022年春アニメだが7月10日に12話予定
        //     さらに最速以外の配信サイトは5日遅れなので15日だが…まあ1日くらいは気にしないことにする
        14,
    )
    const current = Date.now()
    return current > startDate.getTime() && endDate.getTime() > current
}

export function calcStatusScore(
    statuses: { status: WatchStatus }[],
    season: SeasonStruct | undefined | null,
) {
    let score = 0
    for (const s of statuses) {
        score += statusScore(s.status, season)
    }
    return score
}

export type ServiceID = `mal:${string}` | `annict:${string}` | `anilist:${string}`

export type WatchStatus = typeof WATCH_STATUS[number]

export interface AnimeStatus {
    sourceServiceID: ServiceID
    myAnimeListID?: number
    status: WatchStatus
}

export interface UserAnimeStatus {
    id: ServiceID
    avatarUrl?: string
    works: AnimeStatus[]
}

export function idToURL(id: ServiceID) {
    if (id.startsWith("mal:")) {
        return `https://myanimelist.net/anime/${id.split(":")[1]}`
    } else if (id.startsWith("annict:")) {
        return `https://annict.com/works/${id.split(":")[1]}`
    } else if (id.startsWith("anilist:")) {
        return `https://anilist.co/anime/${id.split(":")[1]}`
    }
}

export function malIdIfPossible(status: AnimeStatus): ServiceID {
    if (status.myAnimeListID != null) {
        return `mal:${status.myAnimeListID}` as const
    } else {
        return status.sourceServiceID
    }
}

export const ANIME_TYPE = ["TV", "MOVIE", "OVA", "ONA", "OTHERS"] as const

export type AnimeType = typeof ANIME_TYPE[number]

export const SEASONS = ["WINTER", "SPRING", "SUMMER", "AUTUMN"] as const
export type Season = typeof SEASONS[number]

export const READABLE_SEASON: Record<Season, string> = {
    WINTER: "冬",
    SPRING: "春",
    SUMMER: "夏",
    AUTUMN: "秋",
}

export interface AnimeInfo {
    id: ServiceID
    idMal?: number
    idAnnict?: number
    idAniList?: number
    title?: string
    horizontalCoverURL?: string
    verticalCoverURL?: string
    type: AnimeType | null
    season: {
        year: number
        name: Season | null
    } | null
}
