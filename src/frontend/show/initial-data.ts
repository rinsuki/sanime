import type { ViewsShowData } from "../../page-types/show.js"

const usersData = document.getElementById("page-data")
if (usersData == null) {
    alert("page-data not found")
    throw new Error("page-data not found")
}

const data = JSON.parse(usersData.innerHTML) as ViewsShowData
console.log(data)
export const { users, animes, warns } = data
