import React from "react"

import { AnimeInfo, WatchStatus, WATCH_STATUS } from "../../../type.js"

import { AnimeTypeIcon } from "./anime-type-icon.js"
import { CoolThumbnail } from "./cool-thumbnai.js"
import { SeasonComponent } from "./season.js"
import { UserIcon } from "./user-icon.js"

import "./anime.css"

export const AnimeComponent: React.FC<{
    anime: AnimeInfo
    status: Map<WatchStatus, string[]>
    unknownUsers: string[]
}> = ({ anime, status, unknownUsers }) => {
    return (
        <div className="anime-component">
            {anime.verticalCoverURL != null && (
                <CoolThumbnail
                    className="anime-component-cover"
                    lazy
                    src={anime.verticalCoverURL}
                />
            )}
            <div className="anime-component-body">
                <span className="anime-component-miniinfo">
                    {anime.season != null && <SeasonComponent season={anime.season} />}
                    {anime.type != null && <AnimeTypeIcon type={anime.type} />}
                </span>
                <h2>{anime.title}</h2>
                <div className="anime-component-links">
                    {anime.idAnnict != null && (
                        <span>
                            <a href={`https://annict.com/works/${anime.idAnnict}`}>Annict</a>
                        </span>
                    )}
                    {anime.idAniList != null && (
                        <span>
                            <a href={`https://anilist.co/anime/${anime.idAniList}`}>AniList</a>
                        </span>
                    )}
                    {anime.idMal != null && (
                        <span>
                            <a href={`https://myanimelist.net/anime/${anime.idMal}`}>MyAnimeList</a>
                        </span>
                    )}
                </div>
                <ul className="anime-component-status">
                    {WATCH_STATUS.filter(s => status.has(s)).map(s => (
                        <li key={s}>
                            <span className="anime-component-status-title">
                                {s} ({status.get(s)!.length}):{" "}
                            </span>
                            <span className="anime-component-status-users">
                                {status.get(s)!.map(userName => {
                                    return <UserIcon userName={userName} key={userName} />
                                })}
                            </span>
                        </li>
                    ))}
                    {unknownUsers.length > 0 && (
                        <li className="anime-component-status-unknown">
                            <span className="anime-component-status-title">
                                UNKNOWN ({unknownUsers.length}):{" "}
                            </span>
                            <span className="anime-component-status-users">
                                {unknownUsers.map(userName => {
                                    return <UserIcon userName={userName} key={userName} />
                                })}
                            </span>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    )
}
