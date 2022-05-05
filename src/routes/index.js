import JQL from "../pages/jql";
import getPathName from "../utils/getPathName";

const routes = {
    '/index.html': JQL,
}

const router = async() => {
    const content = document.getElementById('connector')
    let pathName = await getPathName()
    setTimeout(async() => {
        try {
            let dataObj = JSON.parse(tableau.connectionData);
            let render = routes[`/${dataObj.connectionType}`]
            content.innerHTML = await render()
        } catch (e) {
            let render = routes[pathName] ? routes[pathName] : JQL
            content.innerHTML = await render()
        }
    }, 100)
}

export default router