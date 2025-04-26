import React from "react"

import { users } from "../initial-data.js"

export const UserIcon: React.FC<{ userName: string }> = ({ userName }) => {
    let link
    if (userName.startsWith("annict:")) {
        link = `https://annict.com/@${userName.substring("annict:".length)}`
    } else if (userName.startsWith("anilist:")) {
        link = `https://anilist.co/user/${userName.substring("anilist:".length)}`
    } else if (userName.startsWith("mal:")) {
        link = `https://myanimelist.net/profile/${userName.substring("mal:".length)}`
    } else {
        throw new Error("unknown user type, need to implement it")
    }
    return (
        <a href={link} className="anime-component-status-user" title={userName}>
            <img src={users.find(u => u.id === userName)?.avatarUrl ?? undefined} loading="lazy" />
        </a>
    )
}
