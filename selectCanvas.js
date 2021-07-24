function loadAllCanvas() {
    async function get(url , mode)
    {
        fetch(url)
            .then(response => response.json())
            .then(function(data) {
                for (let canvas of data["results"])
                {
                    let btn = document.createElement("BUTTON");
                    btn.innerHTML = canvas["title"]
                    if (canvas["status"] === "OPEN")
                    {
                        document.getElementById("Open").appendChild(btn)
                    }
                    else if (canvas["status"] === "CLOSED")
                    {
                        document.getElementById("Closed").appendChild(btn)
                    }
                    else
                    {
                        document.getElementById("Soon").appendChild(btn)
                    }
                    if (canvas["status"] !== "OPEN")
                    {
                        btn.disabled = true
                        continue
                    }
                    btn.addEventListener("click", function ()
                    {
                        window.location.href = './canvas.html?canvasId=' + canvas["canvasId"] + "&mode=" + mode;
                    });
                }
            })
    }
    get("https://api-sandbox.poap.art/canvas", "sandbox");
    get("https://api.poap.art/canvas", "app");
}

loadAllCanvas()
