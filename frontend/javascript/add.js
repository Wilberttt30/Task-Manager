const inputTask = document.getElementById('inputTask')
const addBtn = document.getElementById('addBtn')
const error = document.getElementById('error')

addBtn.addEventListener('click', async (e) => {
    e.preventDefault()

    const response = await fetch('http://localhost:3000', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            task: inputTask.value
        })
    })
    console.log(response)
    const result = await response.json()
    console.log(result)
    if (result.status === 406) {
        error.innerHTML = result.error
    } else {
        location.replace('./')
    }
})