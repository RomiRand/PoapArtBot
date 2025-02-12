const connectButton = document.getElementById('connectButton');
const hideButton = document.getElementById('hideBtn');
const exportButton = document.getElementById('exportBtn');
const importButton = document.getElementById('importBtn');
const baseCanvas = document.getElementById('baseCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const drawModeButton = document.getElementById('drawModeBtn');
const backgroundButton = document.getElementById('backgroundBtn');

const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)
const canvasId = urlParams.get('canvasId')
const mode = urlParams.get('mode')

let title
let bearer = ""
let api = mode === "sandbox" ? "api.sandbox.poap.art/" : "api.poap.art/"
let main = api + "canvas/"
let baseUrl = "https://" + main
let idx_array
/** @type {string | null} My Ethereum address from MetaMask */
let myAddress = null;

exportButton.disabled = true;

function secondsSinceEpoch()
{
    return Math.round(Date.now()) - 15 * 60 * 1000
}

let webSocket = null;
setupWebsocket();

/**
 * Setup autorestarting websocket: will automatically recreate itself on failure,
 * after waiting 60 seconds.
 *
 * Websocket is used to record new pixel updates.
 */
function setupWebsocket() {
  const localWebSocket = new WebSocket("wss:" + main + canvasId);
  if (webSocket) { // close old websocket
    webSocket.close();
  }
  webSocket = localWebSocket;
  webSocket.addEventListener("message", onMessage);
  webSocket.addEventListener("open", function onOpen(_event) {
    console.log(`WebSocket connection open!`);
  });
  webSocket.addEventListener("close", function onClose(event) {
    console.error(`Websocket closed with ${event}`);
    console.info("Recreating websocket connection in 60s");
    setTimeout(setupWebsocket, 60 * 1000);
  });
}

async function setTable(id)
{
    let map
    document.getElementById(id).innerHTML = "";
    let tbody = document.getElementById(id);
    if (id === "friendlyTableBody")
    {
        map = friendlyArtistsList
    }
    else if (id === "enemyTableBody")
    {
        map = enemyArtistsList
    }

    async function logMapElements(value, key, map) {
        let row = tbody.insertRow(0)
        let addr = row.insertCell(0)
        addr.innerHTML = key
        let count = row.insertCell(1)
        count.innerHTML = value[1]
    }
    map.forEach(logMapElements)

    await delay(1100)
    setTable(id)
}

let friendlyArtistsList = new Map()
let enemyArtistsList = new Map()
setTable('friendlyTableBody')
setTable('enemyTableBody')

/**
 * Records the placement of a pixel in friendly/enemy artist table.
 *
 * @param {number} x - X co-ordinate
 * @param {number} y - Y co-ordinate.
 * @param {keyof palette} recvColorIdx - Index number of the color that was painted.
 * @param {string} _hexTime - Time of pixel placement as a hex string.
 * Currently unused.
 * @param {string} address - Wallet address of the person who painted this pixel.
 * @param {string | null} ens - Wallet ENS, if set.
 */
function recordPixelPlacement(x, y, recvColorIdx, _hexTime, address, ens) {
    const withinImageRange = (
      img.x <= x && x < img.x + img.w &&
      img.y <= y && y < img.y + img.h
    );
    if (!withinImageRange) {
      return;
    }

    const col = drawCtx.getImageData(x, y, 1, 1).data;
    let expectedColorIdx = approximateColor(col[0], col[1], col[2])
    let i = (y - img.y) * img.w + x - img.x
    const wallet = ens ?? address; // use ENS if it exists

    if (recvColorIdx !== expectedColorIdx)
    {
        idx_array.push(i) // record that we need to overwrite enemy pixel
        let new_count = 0
        let old_count = enemyArtistsList.get(wallet)
        if (old_count)
        {
            new_count = old_count[1] + 1
        }
        enemyArtistsList.set(wallet, [secondsSinceEpoch(), new_count])
    }
    else
    {
        idx_array.splice(idx_array.indexOf(i), 1)
        if (address.toUpperCase() === myAddress.toUpperCase())
        {
            // filter ourselves
            return;
        }
        let new_count = 0
        let old_count = friendlyArtistsList.get(wallet)
        if (old_count)
        {
            new_count = old_count[1] + 1
        }
        friendlyArtistsList.set(wallet, [secondsSinceEpoch(), new_count])
    }
}

/**
 * Handles WebSocket `"message"` events from poap.art
 * @param {MessageEvent} event - Message event.
 */
function onMessage(event) {
    let msg = JSON.parse(event.data);
    const eventType = msg[0];
    switch (eventType) {
        case "pixel": {
            const [_type, x, y, colorIdx, _hexTime, address, ens] = msg;
            drawPixel(x, y, colorIdx);
            recordPixelPlacement(x, y, colorIdx, _hexTime, address, ens);
            break;
        }
        case "pixels": {
          for (const [x, y, colorIdx] of msg[1]) {
            drawPixel(x, y, colorIdx);
          }
          break;
        }
        case "online": {
          break; // ignore
        }
        default: {
          console.log(`Unknown WebSocket message of type: ${eventType}`);
        }
    }
}

function setupCanvas()
{
    if (canvasId === "")
        return;
    let url = baseUrl + canvasId + "?palette=1"
    fetch(url)
        .then(response =>
        {
            if (!response.ok) {
                throw new Error("check canvas id")
            }
            return response.json();
        })
        .then(data => {
            palette = data["palette"]
            baseCanvas.width = data["cols"] * data["chunkSize"]
            baseCanvas.height = data["rows"] * data["chunkSize"]
            drawCanvas.width = data["cols"] * data["chunkSize"]
            drawCanvas.height = data["rows"] * data["chunkSize"]
            title = data["title"]
            for (let r = 0; r < data["rows"]; ++r)
            {
                for(let c = 0; c < data["cols"]; ++c)
                {
                    drawChunk(r, c, data["chunkSize"]);
                }
            }
        })
        .catch((error) => {
            alert(error);
        });
}

setupCanvas();

let baseCtx = baseCanvas.getContext("2d");
let drawCtx = drawCanvas.getContext("2d");

/**
 * Gets the data for a specific chunk.
 *
 * Automatically retries up to 5 times in case of failure before throwing an error,
 * e.g. if the POAP.art servers are being slow, causing a Cloudflare CDN error.
 *
 * @param {number} row - Chunk row number.
 * @param {number} col - Chunk column number.
 * @returns {Promise<ArrayBuffer>} The chunk data, where each byte is a UInt8
 * representing the colorId in the palette array. (e.g. 1 will be #F3F3F4).
 */
async function getChunk(row, col)
{
    if (canvasId === "")
        return;
    const url = new URL(`${baseUrl}${canvasId}/chunk/${row}:${col}`);
    // commenting out since official website no longer uses this
    // and keeping it may invalid caching
    // url.searchParams.set("since", secondsSinceEpoch().toString(16));
    const maxTries = 5; // try 5 times before failing
    let tries = 0;
    while (true) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return await response.arrayBuffer();
        } else {
          throw new Error(
            `Fetching ${url} failed with code ${response.status}, `
            + `and text ${await response.text()}`
          );
        }
      } catch (error) {
        tries++;
        if (tries < maxTries) {
          console.warn(
            `Failed ${tries} times at loading chunk ${url} with error ${error}.\n`
            + `Retrying after a delay of ${tries} seconds.`
          );
          await delay(1000 * tries);
        } else {
          throw new Error(
            `Failed ${tries} times at loading chunk ${url}. Latest error was ${error}.`
          );
        }
      }
    }
}

let palette

function drawPixel(x, y, colorIdx)
{
    let color = palette[colorIdx];
    let imageData = baseCtx.getImageData(x, y, 1, 1);
    imageData.data[0] = parseInt(color.slice(0, 2), 16);
    imageData.data[1] = parseInt(color.slice(2, 4), 16);
    imageData.data[2] = parseInt(color.slice(4, 6), 16);
    imageData.data[3] = 255;
    baseCtx.putImageData(imageData, x, y);
}

/**
 * Paints a pixel on the POAP canvas.
 *
 * Resolves when ready to paint the next pixel.
 * Should the painting HTTP call take too long, this will abort the paint call,
 * and throw an `AbortError`.
 *
 * @param {number} x - X co-ordinate
 * @param {number} y - Y co-ordinate.
 * @param {keyof palette} color - Index number of the color to paint.
 * Use {@link approximateColor} to find the color index.
 * @throws {AbortError} Rejects with `AbortError` if the HTTP call timed-out.
 * Default timeout is 5 seconds (same as official POAP.art client).
 * @returns {Promise<void>} Resolves after `waitSeconds`, when ready to paint
 * the next pixel.
 */
async function paintPixel(x, y, color)
{
    if (bearer === "")
        return;
    const url = new URL(`${baseUrl}${canvasId}/paint`);
    const data = {x: x, y: y, color: color};

    // We use AbortController to automatically cancel the HTTP call
    const controller = new AbortController();
    const signal = controller.signal;
    // abort will be ignored if the HTTP call succeeded earlier
    // poap.art website also aborts /paint calls after 5 seconds
    setTimeout(() => controller.abort(), 5000);

    const params = {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + bearer,
            'X-POAP-Art-Bot': 'RamiRond Bot', // in case POAP.art team needs to block us
        },
        signal, // fetch will timeout after xxx seconds
    };

    const paintResponse = await fetch(url, params);
    const paintData = await paintResponse.json();
    // follow wait seconds (some canvases are faster the more POAPs you have)
    const waitSeconds = paintData?.waitSeconds ?? 1;
    await delay(1000 * waitSeconds + 200); // add 200ms extra delay
}

async function drawChunk(row, col, size)
{
    getChunk(row, col).then(function (chunk)
    {
        let view = new Uint8Array(chunk);
        let imageData = baseCtx.getImageData(col * size, row * size, size, size);
        for (let idx = 0; idx < view.length; idx++)
        {
            if (view[idx] === 0)
                continue;
            let color = palette[view[idx]];
            if (typeof color === 'undefined')
                console.log("handle")
            imageData.data[idx * 4 + 0] = parseInt(color.slice(0, 2), 16);
            imageData.data[idx * 4 + 1] = parseInt(color.slice(2, 4), 16);
            imageData.data[idx * 4 + 2] = parseInt(color.slice(4, 6), 16);
            imageData.data[idx * 4 + 3] = 255;
        }
        baseCtx.putImageData(imageData, col * size, row * size);
    })
}

// drawChunk(0,0);

let pos = { x: 0, y: 0 };

//window.addEventListener('resize', resize);
document.addEventListener('mousemove', mouseMove);
document.addEventListener('mousedown', mouseDown);
document.addEventListener('mouseup', resetCursor);
document.addEventListener('mouseenter', setPosition);

let scale = 1;
var tempCanvas=document.createElement("canvas");
var tctx=tempCanvas.getContext("2d");

function resetCursor(event)
{
    drawCanvas.style.cursor = "default";
    imageClicked = false;
}
function mouseDown(event)
{
    setPosition(event);
    imageClicked = mouseOnImage()
}
let imageClicked = false;
// new position from mouse event
function setPosition(event) {
    let rect = baseCanvas.getBoundingClientRect();
    pos.x = event.clientX - rect.left;
    pos.y = event.clientY - rect.top;
}

// resize canvas
function resize() {
    baseCtx.canvas.width = window.innerWidth;
    baseCtx.canvas.height = window.innerHeight;
}

function mouseOnImage()
{
    return img.x <= pos.x && pos.x <= img.x + img.w &&
           img.y <= pos.y && pos.y <= img.y + img.h
}

let ctrlPressed = false;

document.addEventListener('keydown', (event) => {
    const keyName = event.key;

    if (keyName === 'Control')
        ctrlPressed = true
});

document.addEventListener('keyup', (event) => {
    const keyName = event.key;

    if (ctrlPressed && keyName === 'Control')
        ctrlPressed = false
});

function mouseMove(event) {
    // mouse left button must be pressed

    if (imageClicked)
    {
        if (drawing)
        {
            return
        }
        if (ctrlPressed)
        {
            const x_bef = pos.x;
            const y_bef = pos.y;
            setPosition(event);
            const diff = (pos.x - x_bef) + (pos.y - y_bef)

            if (diff > 0)
            {
                scale += 0.01
            }
            else if (diff < 0)
            {
                scale -= 0.01
            }
            //scale += diff >= 0 ? 0.01 : -0.01;

            let new_w = Math.round(img.image.naturalWidth * scale);
            let new_h = Math.round(img.image.naturalHeight * scale);
            if (new_w <= 0 || new_h <= 0)
            {
                return;
            }

            img.w = new_w
            img.h = new_h
            drawCtx.clearRect(0,0, drawCanvas.width, drawCanvas.height);
            drawCtx.drawImage(img.image, img.x, img.y, img.w, img.h);
            return;
        }
        drawCtx.clearRect(0,0, drawCanvas.width, drawCanvas.height);
        const x_off = Math.floor(img.w - (img.x + img.w - pos.x))
        const y_off = Math.floor(img.h - (img.y + img.h - pos.y))
        setPosition(event);
        img.x = Math.floor(pos.x - x_off);
        img.y = Math.floor(pos.y - y_off);
        drawCtx.drawImage(img.image, img.x, img.y, img.w, img.h);
        drawCanvas.style.cursor = "move";
        return;
    }
    /*if (event.buttons !== 1)
        return;
    drawCtx.beginPath(); // begin

    drawCtx.lineWidth = 1;
    drawCtx.lineCap = 'square';
    drawCtx.strokeStyle = '#c0392b';

    let x = pos.x;
    let y = pos.y;
    drawCtx.moveTo(pos.x, pos.y); // from
    setPosition(event);
    drawCtx.lineTo(pos.x, pos.y); // to
    if (pos.x - x > 0 && pos.y - y > 0) {
        let imageData = baseCtx.getImageData(x, y, pos.x - x, pos.y - y);
        console.log("size: " + imageData.data.length / 4);
    }

    drawCtx.stroke(); // draw it!*/
}
drawCanvas.style.opacity = '50%'
hideButton.addEventListener('click', async () => {
    updateButtons(true)
});

function updateButtons(next)
{
    if (next)
    {
        if (drawCanvas.style.opacity === '0') {
            hideButton.style.backgroundColor = "yellow";
            drawCanvas.style.opacity = "50%";
        } else if (drawCanvas.style.opacity === '0.5') {
            hideButton.style.backgroundColor = "lightgreen";
            drawCanvas.style.opacity = "100%";
        } else {
            hideButton.style.backgroundColor = "indianred";
            drawCanvas.style.opacity = "0%";
        }
    }
    showBottomBar(drawCanvas.style.opacity !== "0")
}

function showBottomBar(show)
{
    let vis
    if (show)
        vis = "visible"
    else
        vis = "hidden"

    let befImport = document.getElementsByClassName("beforeImport");
    for (let i = 0; i < befImport.length; i++) {
        befImport[i].style.visibility = vis
    }
    if (img.image.src !== "")
    {
        let aftImport = document.getElementsByClassName("afterImport");
        for (let i = 0; i < aftImport.length; i++) {
            aftImport[i].style.visibility = vis
        }
    }
}

async function isConnected()
{
    let res = await ethereum.request({method: 'eth_accounts'})
    return res.length > 0
}

let error = false
updateConnectButton()

async function updateConnectButton()
{
    if (error)
    {
        connectButton.innerHTML = "error, reload page"
    }
    else if (!await isConnected())
    {
        connectButton.innerHTML = "connect"
        connectButton.disabled = false
    }
    else if (bearer === "")
    {
        connectButton.innerHTML = '"sign" in'
        connectButton.disabled = false
    }
    else if (img.image.src === "")
    {
        drawModeButton.style.visibility = "hidden"
        backgroundButton.style.visibility = "hidden"
        connectButton.innerHTML = "Drop or import image"
        connectButton.disabled = true
    }
    else if (!drawing)
    {
        let befImport = document.getElementsByClassName("beforeImport")[0]
        for (let i = 0; i < befImport.children.length; i++) {
            befImport.children[i].disabled = false
        }
        drawModeButton.style.visibility = "visible"
        backgroundButton.style.visibility = "visible"
        connectButton.className = 'mmBtn'
        connectButton.innerHTML = 'draw!'
        connectButton.disabled = false
        backgroundButton.disabled = false
    }
    else
    {
        let befImport = document.getElementsByClassName("beforeImport")[0]
        for (let i = 0; i < befImport.children.length; i++) {
            befImport.children[i].disabled = true
        }
        // lock in decision
        backgroundButton.disabled = true
        connectButton.innerHTML = ''
        connectButton.className = 'mmBtnDrawing'
    }
}

connectButton.addEventListener('click', async () => {
    if (connectButton.innerHTML === "connect")
    {
        ethereum.request({ method: 'eth_requestAccounts' }).then(function(){
            updateConnectButton()
        })
    }
    else if (connectButton.innerHTML === '"sign" in')
    {
        singIn().then(function(){
            updateConnectButton()
        })
    }
    else if (connectButton.innerHTML === "draw!")
    {
        draw().catch(function() {
            drawing = false
            updateConnectButton()
        })
        updateConnectButton()
    }
    else if (connectButton.className === 'mmBtnDrawing')
    {
        drawing = false
        updateConnectButton()
    }
    else
    {
        error = true
        updateConnectButton()
    }
});

async function singIn()
{
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    myAddress = EthJS.Util.toChecksumAddress(accounts[0])

    // let params = [addr, msgParams];
    let params = ["Hi there from POAP.art!\nSign this message to log in and become an artist", myAddress];
    // let method = 'eth_signTypedData_v4';
    let method = 'personal_sign';
    await window.ethereum.request(
        {
            method: method,
            params: params,
            //from: myAddress,
            //id: 1
        }
    ).then(async function (result, err) {
        if (err)
            return console.dir(err);
        if (result.error) {
            alert(result.error.message);
        }
        if (result.error)
            return console.error('ERROR', result);

        //let url = baseUrl + canvasId + "/signin"
        let url = "https://" + api + "signin"
        const data= {
            //wallet: myAddress,
            //chainId: 1,
            signature: result
        }
        const params = {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json'
            }
        }
        await fetch(url, params)
            .then(data=>{return data.json()})
            .then(res=>{
                bearer = res["accessToken"];
            });
    })
}

async function getCurrentColor(x, y)
{
    const imageData = baseCtx.getImageData(x, y, 1, 1).data
    if (imageData[3] === 0) // transparent background => white
        return "not set"

    return (imageData[0].toString(16).padStart(2, '0') +
        imageData[1].toString(16).padStart(2, '0') +
        imageData[2].toString(16).padStart(2, '0')).toUpperCase()
}

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}


function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function approximateColor(r, g, b)
{
    let min_idx = -1;
    let min_dist = Number.MAX_VALUE;
    for (let j = 0; j < palette.length; j++)
    {
        let col_r = parseInt(palette[j].slice(0, 2), 16);
        let col_g = parseInt(palette[j].slice(2, 4), 16);
        let col_b = parseInt(palette[j].slice(4, 6), 16);
        // approximate using euclidean distance which is typically used for this task
		// (see: https://en.wikipedia.org/wiki/Color_quantization#Algorithms)
        let dist = Math.sqrt(Math.pow(r - col_r, 2) + Math.pow(g - col_g, 2) + Math.pow(b - col_b, 2));
        if (dist < min_dist)
        {
            min_dist = dist;
            min_idx = j;
            if (dist === 0)
                break;
        }
    }
    return min_idx;
}

let drawMode = "random"
let background = false
let drawing = false
async function draw()
{
    drawing = true
    const imgData = drawCtx.getImageData(img.x, img.y, img.w, img.h).data;
    idx_array = [...Array(imgData.length / 4).keys()]
    const total = idx_array.length
    let progressBar = document.getElementById("progressbar").children
    for (;;)
    {
        if (!drawing)   // shouldn't be set from outside...
            break
        let percent = 100 * (total - idx_array.length) / total
        progressBar[1].style.width = percent + '%'
        progressBar[0].innerHTML = percent.toFixed(2) + "% drawn (" + (total - idx_array.length) + "/" + total + " Pixel)"
        if (idx_array.length === 0)
        {
            if (background)
                break
            await delay(1000)
            continue
        }

        let idx
        if (drawMode === "random")
            idx = getRandomInt(idx_array.length)
        else if (drawMode === "rows")
            idx = 0
        let i = idx_array[idx] * 4

        // get current color
        const x = img.x + (i / 4 % img.w)
        const y = img.y + Math.trunc(((i / 4) / img.w))
        let cur_col = await getCurrentColor(x, y)
        if (background && cur_col !== "not set")
        {
            idx_array.splice(idx, 1)
            continue
        }
        if (cur_col === "not set")
        {
            cur_col = "FFFFFF"
        }

        // get new color
        const red = imgData[i];
        const green = imgData[i + 1];
        const blue = imgData[i + 2];
        const alpha = imgData[i + 3];
        if (alpha <= 16)
        {// almost transparent, we can probably hide it
            idx_array.splice(idx, 1)
            continue
        }
        let min_idx = approximateColor(red, green, blue)

        // check if we need to update
        if (cur_col !== palette[min_idx])
          try{
            await paintPixel(x, y, min_idx)
          } catch (error) {
            console.error(`Error in paintPixel: ${error}`);
          }
        else
            idx_array.splice(idx,1)
    }
}

// Image for loading
let img = {
    image: document.createElement("img"),
    x: 0,
    y: 0,
    w: -1,
    h: -1
}
img.image.addEventListener("load", function () {
    if (drawing)
    {
        return
    }
    if (img.w === -1 || img.h === -1) {
        img.w = img.image.width
        img.h = img.image.height
    }
    // assume same scaling for height
    scale = img.w / img.image.naturalWidth
    drawCtx.clearRect(0,0, drawCanvas.width, drawCanvas.height);
    drawCtx.drawImage(img.image, img.x, img.y, img.w, img.h);
    updateButtons()
    updateConnectButton()
}, false)

// To enable drag and drop
drawCanvas.addEventListener("dragover", function (evt) {
    evt.preventDefault();
}, false);


function loadWebImage(url)
{
    img.image.src = url;
    img.image.crossOrigin = "Anonymous"
    setExportButton(true)
}

function setExportButton(enabled)
{
    if (enabled)
    {
        exportButton.disabled = false
        exportButton.innerText = 'Export'
    }
    else
    {
        exportButton.disabled = true
        exportButton.innerText = 'Export (paste image from url)'
    }
}

function copyTextToClipboard(text) {
    // https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
    var textArea = document.createElement("textarea");
    textArea.value = text;

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let successful = false
    try {
        successful = document.execCommand('copy');
    } catch (err) {
        console.log('Oops, unable to copy');
    }
    document.body.removeChild(textArea);
    return successful
}

exportButton.addEventListener("click", async function(event) {
    let exportStr = {
        url: img.image.src,
        x: img.x,
        y: img.y,
        w: img.w,
        h: img.h
    }
    if (copyTextToClipboard(JSON.stringify(exportStr)))
    {
        exportButton.innerText = "Copied to clipboard!"
    }
    else
    {
        exportButton.innerText = "Error!"
    }
    await delay(3000)
    setExportButton(true)
})

importButton.addEventListener("click", async function(event){
    let config = document.getElementById('configImport').value
    if (config === '')
        return
    try
    {
        let res = JSON.parse(config)
        img.x = res.x
        img.y = res.y
        img.w = res.w
        img.h = res.h
        loadWebImage(res.url)
    } catch(e) {
        //
    }
})

function isUrl(str)
{
    var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
        '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(str);
}

drawCanvas.addEventListener("drop", function (evt) {
    var files = evt.dataTransfer.files;
    if (files.length > 0) {
        var file = files[0];
        if (typeof FileReader !== "undefined" && file.type.indexOf("image") !== -1) {
            var reader = new FileReader();
// Note: addEventListener doesn't work in Google Chrome for this event
            reader.onload = function (evt2) {
                img.x = evt.pageX;
                img.y = evt.pageY;
                img.w = -1
                img.h = -1
                img.image.src = evt2.target.result;
                setExportButton(false);
            };
            reader.readAsDataURL(file);
        }
    }
    else if (evt.dataTransfer.items.length > 1)
    {
        function loadImage(str)
        {
            img.x = evt.pageX
            img.y = evt.pageY
            img.w = -1
            img.h = -1
            loadWebImage(str)
        }
        evt.dataTransfer.items[1].getAsString(loadImage)
    }
    evt.preventDefault();
}, false);

drawModeButton.addEventListener("click", async function(event)
{
    if (drawMode === "random")
        drawMode = "rows"
    else if (drawMode === "rows")
        drawMode = "random"
    drawModeButton.innerText = drawMode
})

backgroundButton.addEventListener("click", async function(event)
{
    let backgroundStr
    background = !background
    if (background)
        backgroundStr = "Background only"
    else
        backgroundStr = "Normal"
    backgroundButton.innerText = backgroundStr
})
