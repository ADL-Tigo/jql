const getPathName = () =>{
    const pathname = location.pathname.split("/").pop().toLowerCase() || "";
    return "/" + pathname;
}
export default getPathName