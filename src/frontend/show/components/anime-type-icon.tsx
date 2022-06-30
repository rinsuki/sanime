import { faTv, faFilm, faCompactDisc, faGlobe, faOtter } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"

import { AnimeType } from "../../../type.js"

export const AnimeTypeIcon: React.FC<{ type: AnimeType }> = ({ type }) => {
    switch (type) {
        case "TV":
            return <FontAwesomeIcon icon={faTv} />
        case "MOVIE":
            return <FontAwesomeIcon icon={faFilm} />
        case "OVA":
            return <FontAwesomeIcon icon={faCompactDisc} />
        case "ONA":
            return <FontAwesomeIcon icon={faGlobe} />
        case "OTHERS":
            return <FontAwesomeIcon icon={faOtter} />
    }
}
