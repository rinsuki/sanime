import React from "react"

import { isNearCurrentOrAfterSeason, READABLE_SEASON, SeasonStruct } from "../../../type.js"

import "./season.css"

export const SeasonComponent: React.FC<{ season: SeasonStruct }> = ({ season }) => {
    let content = `'${season.year.toString().slice(-2)}`
    if (season.name != null) {
        content += " " + READABLE_SEASON[season.name]
    }
    const nearCurrentSeasonOrLater = isNearCurrentOrAfterSeason(season)
    if (nearCurrentSeasonOrLater) {
        return (
            <span className="seasoncomponent" data-current-season>
                {content}
            </span>
        )
    } else {
        return <span className="seasoncomponent">{content}</span>
    }
}
