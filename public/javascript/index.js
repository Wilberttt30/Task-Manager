const container = document.getElementById('container')
const pagination = document.getElementById('pagination')
const user = document.getElementById('greetUser')

const template = `
    <div class='item'>
        <input type="checkbox" id="{id}" {checked}>
        <p id="status">{taskName}</p>
        <a href="edit?editID={editID}">Edit</a>
        <button id="delete{ID}">Delete</button>
    </div>
`

fetchApi()

async function fetchApi() {
    const urlParams = new URLSearchParams(window.location.search)
    const page = urlParams.get('page') || '1'
    const limit = urlParams.get('limit') || '5'

    // Fetch API
    const response = await fetch(`http://localhost:3000/api?page=${page}&limit=${limit}`, { method: 'GET' })
    const responseUser = await fetch('http://localhost:3000/api/user')
    const result = await response.json()
    const resultUser = await responseUser.json()
    // Show Task
    const tasks = result.task.results

    user.innerHTML = `Hello ${resultUser.user}`

    const notedID = []
    tasks.map((task) => {
        notedID.push(task.id)
        container.innerHTML += template.replace('{id}', task.id).replace('{taskName}', task.taskName).replace('{checked}', task.status ? 'checked' : "").replace('{ID}', task.id).replace('{editID}', task.id)
    })

    for (let i = 0; i < notedID.length; i++) {
        const id = document.getElementById(notedID[i]) 
        const deleteId = document.getElementById(`delete${notedID[i]}`) 
        // Click
        id.addEventListener('click', async () => {
            if (id.checked == true) statusTask = true
            if (id.checked == false) statusTask = false
            
            await fetch(`http://localhost:3000/api/${notedID[i]}`, {
                method: 'PATCH',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: notedID[i],
                    statusTask: statusTask
                })
            })
        })
        // Delete
        deleteId.addEventListener('click', async () => {
            await fetch(`http://localhost:3000/api/${notedID[i]}`, {
                method: 'DELETE',
            })
            location.reload()
        })
    }
    
    // Pagination Page
    const previous = result.task.previous
    const next = result.task.next
    
    // Previous Page
    if (previous != undefined) {
        const previousPage = document.createElement('a')
        previousPage.innerHTML = 'Previous'
        previousPage.setAttribute('href', `?page=${previous.page}&limit=5`)
        pagination.appendChild(previousPage)
    }
    
    // Next Page
    if (next != undefined ) {
        const nextPage = document.createElement('a')
        nextPage.innerHTML = 'Next'
        nextPage.setAttribute('href', `?page=${next.page}&limit=5`)
        pagination.appendChild(nextPage)
    }
}