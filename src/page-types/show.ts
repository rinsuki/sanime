import { AnimeInfo, ServiceID, UserAnimeStatus } from "../type.js"
export interface ViewsShowData {
    users: UserAnimeStatus[]
    animes: Record<ServiceID, AnimeInfo>
    warns: string[]
}
