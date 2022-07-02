import { WatchStatus } from "../../type.js"

export interface AnimeUserStatus {
    user: string
    status: WatchStatus
}

export const filterModes = [
    "NOT_WATCHED",
    "NOT_SEEN",
    "KNOW",
    "NOT_KNOW",
    "ONLY_WATCHED",
    "CHOTTO_WATCHED",
    "WANT",
] as const
export const filterModeName: Record<FilterMode, string> = {
    ONLY_WATCHED: "見終わった",
    NOT_WATCHED: "見終わっていない",
    NOT_SEEN: "見たことがない",
    KNOW: "知ってる",
    NOT_KNOW: "知らない",
    CHOTTO_WATCHED: "少しでも見たことがある",
    WANT: "見たい",
}

export type FilterMode = typeof filterModes[number]
