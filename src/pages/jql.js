//script en seco
import getData from '../utils/getData'

const JQL = async() => {
    await getData('jql')
    return `
    <h1>Get Mixpanel Data for a Script JQL</h1>
    <div>
        <label for="query_id" class="form-label">Script JQL</label>
        <textarea
          class="form-control"
          id="query_id"
          placeholder="Leave a JQL here"
          style="height: 460px"></textarea>
    </div>
    `
}

export default JQL