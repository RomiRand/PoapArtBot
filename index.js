const ethereumButton = document.getElementById('enableEthereumButton');
const hideButton = document.getElementById('hideBtn');
const signTypedDataV3Button = document.getElementById('signTypedDataV4Button');
const startDraw = document.getElementById('startDraw');
const baseCanvas = document.getElementById('baseCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const friendlyTable = document.getElementById('FriendlyTable');


let canvasId = "nKOjzq"
let bearer = ""
let baseUrl = "https://api-sandbox.poap.art/"
let chunkSize = 0
let rows = 0
let cols = 0
let idx_array
let addr
let friendlyArtists = 0
let enemyArtists = 0

let provider, ens
async function setup()
{
    provider = await detectEthereumProvider()
    ens = new EthENS.Ens({ provider, network: '1' });
}

setup()

async function reverse(addr)
{
    if (!provider)
    {
        return addr
    }

    return await ens.reverse(addr)
        .then((name) => {
            return name
        })
        .catch((reason) => {
            return addr
    })
}

function secondsSinceEpoch()
{
    return Math.round(Date.now()) - 15 * 60 * 1000
}

let webSocket = new WebSocket("wss://api-sandbox.poap.art/" + canvasId);//?since=" + secondsSinceEpoch.toString(16));
webSocket.addEventListener("message", onMessage);
webSocket.addEventListener("open", onOpen);
function onOpen (event) {
    // let msg = JSON.parse(event);
    console.log(event);
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
        let row = tbody.insertRow(0);
        let cell = row.insertCell(0)
        cell.innerHTML = key
    }
    map.forEach(logMapElements)

    await delay(1100)
    setTable(id)
}

let friendlyArtistsList = new Map()
let enemyArtistsList = new Map()
setTable('friendlyTableBody')
setTable('enemyTableBody')

async function onMessage (event) {
    let msg = JSON.parse(event.data);
    if (msg[0] === "pixel")
    {
        drawPixel(msg[1], msg[2], msg[3]);
        if (img.x <= msg[1] && msg[1] < img.x + img.image.width &&
            img.y <= msg[2] && msg[2] < img.y + img.image.height)
        {
            const col = drawCtx.getImageData(msg[1], msg[2], 1, 1).data;
            let color_idx = approximateColor(col[0], col[1], col[2])
            let i = (msg[2] - img.y) * img.image.width + msg[1] - img.x
            if (msg[3] !== color_idx)
            {
                idx_array.push(i)
                enemyArtists++; // filter ourselves ?
                enemyArtistsList.set(await reverse(msg[5]), secondsSinceEpoch())
            }
            else
            {
                idx_array.splice(idx_array.indexOf(i), 1)
                if (msg[5].toUpperCase() !== addr.toUpperCase())
                {
                    friendlyArtists++
                }
            // TODO add ens cache
                friendlyArtistsList.set(await reverse(msg[5]), secondsSinceEpoch())
            }
        }
    }
    else if (msg[0] === "pixels")
    {
        for (let i in msg[1])
        {
            drawPixel(msg[1][i][0], msg[1][i][1], msg[1][i][2]);
        }
    }
    else
        console.log(msg[0]);
}

function setupCanvas(id)
{
    if (id === "")
        return;
    let url = baseUrl + canvasId
    fetch(url)
        .then(response => response.json())
        .then(function(data) {
            let res = data["rows"] * data["chunkSize"];
            ethereumButton.style.width = res / 4;
            ethereumButton.style.height = res / 8;
            for (let r = 0; r < data["rows"]; ++r)
            {
                for(let c = 0; c < data["cols"]; ++c)
                {
                    drawChunk(r, c, data["chunkSize"]);
                }
            }
        });
}

setupCanvas("nKOjzq");

let baseCtx = baseCanvas.getContext("2d");
let drawCtx = drawCanvas.getContext("2d");

async function getChunk(row, col)
{
    if (canvasId === "")
        return;
    let url = baseUrl + canvasId + "/chunk/" + row + ":" + col + "?since=" + secondsSinceEpoch().toString(16);
    const response = await fetch(url);
    return await response.arrayBuffer();
}

let palette = ["FFFFFF","F3F3F4","E7E7EA","DBDBDF","CFCFD4","C3C3C9","B7B7BF","ABABB4","9F9FA9","93939E","878794","7B7B89","6F6F7E","636373","575769","4B4B5E","F9F9F9","E8E8E8","D8D8D8","C7C7C7","B7B7B7","A6A6A6","959595","858585","747474","646464","535353","424242","323232","212121","111111","000000","FFF0DC","FEEAD5","FDE5CE","FCDFC7","FADABF","F9D4B8","F8CFB1","F7C9AA","F1BB9E","EAAE93","E4A088","DE937C","D78571","D17765","CA6A5A","C45C4E","EADCDA","DEC9C5","D1B6B1","C5A39C","B88F88","AC7C73","9F695F","93564A","885045","7C4940","71433B","663D36","5A3630","4F302B","432926","382321","FFD4D4","FDB6B6","FC9797","FA7979","F95B5B","F73D3D","F61E1E","F40000","E00000","CB0000","B70000","A30101","8E0101","7A0101","650101","510101","FFE1CC","FFD0AF","FFBE92","FFAD75","FF9B57","FF8A3A","FF781D","FF6700","EF6202","DF5D04","CF5805","BF5307","AF4E09","9F490B","8F440C","7F3F0E","FFF8E1","FFF3C7","FFEEAD","FFE993","FFE57A","FFE060","FFDB46","FFD62C","EEC72A","DEB928","CDAA26","BD9C24","AC8D21","9B7E1F","8B701D","7A611B","FFFACF","FFF9BE","FFF9AE","FFF89D","FEF78C","FEF67B","FEF66B","FFF200","EDE002","DCCE04","CABC06","B9AA08","A79709","95850B","84730D","72610F","F1FFCF","E7FFB1","DCFF94","D2FF76","C7FF59","BDFF3B","B2FF1E","A8FF00","9BEA01","8ED401","81BF02","74AA02","669403","597F03","4C6904","3F5404","C5FFC5","AEFAAE","96F596","7FF07F","68EC68","51E751","39E239","22DD22","20CB20","1DBA1D","1BA81B","189618","168416","147314","116111","0F4F0F","CAFFF6","ADFFF2","90FFEE","73FFEA","57FFE6","3AFFE2","1DFFDE","00FFDA","01E7C5","01CFB1","02B79C","039F88","038773","046F5E","04574A","053F35","E1FEFF","CBF9FF","B5F5FF","9FF0FF","8AEBFF","74E6FF","5EE2FF","48DDFF","40CCEB","38BCD7","2FABC3","279BB0","1F8A9C","167988","0E6974","065860","D4DEFF","B6C2FF","97A6FF","798AFF","5B6DFF","3D51FF","1E35FF","0019FF","0016EB","0113D7","0110C3","010EB0","010B9C","020888","020574","020260","F0E3FF","E3C3FF","D6A2FF","C982FF","BC61FF","AF41FF","A220FF","9500FF","8700E9","7900D3","6B00BD","5E00A7","500091","42007B","340065","26004F","FFE3FC","FFD0F8","FFBDF4","FFAAF0","FF98ED","FF85E9","FF72E5","FF5FE1","F056D3","E04DC6","D144B8","C23BAB","B2329D","A3298F","932082","841774","F9E1ED","FAC8DE","FBAFCF","FC96C0","FC7CB2","FD63A3","FE4A94","FF3185","EB2D7B","D72A71","C32667","B0225E","9C1E54","881A4A","741740","601336"]


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


async function paintPixel(x, y, color)
{
    if (bearer === "")
        return;
    let url = baseUrl + canvasId + "/paint"
    const data = {x: x, y: y, color: color}
    const params = {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + bearer
        }
    }
    await fetch(url, params)
        .then(data=>{return data.json()})
        .then(async function(data) {
            console.log("drawn pixel!");
            await delay(1100);
        });
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
    return img.x <= pos.x && pos.x <= img.x + img.image.width &&
           img.y <= pos.y && pos.y <= img.y + img.image.height
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
        if (ctrlPressed)
        {
            const x_bef = pos.x;
            const y_bef = pos.y;
            setPosition(event);
            const diff = (pos.x - x_bef) + (pos.y - y_bef)
            drawCtx.clearRect(0,0, drawCanvas.width, drawCanvas.height);
            img.image.width = diff >= 0 ? img.image.width * 1.01 : img.image.width * 0.99;
            img.image.height = diff >= 0 ? img.image.height * 1.01 : img.image.height * 0.99;
            drawCtx.drawImage(img.image, img.x, img.y, img.image.width, img.image.height);
            return;
        }
        drawCtx.clearRect(0,0, drawCanvas.width, drawCanvas.height);
        const x_off = img.image.width - (img.x + img.image.width - pos.x)
        const y_off = img.image.height - (img.y + img.image.height - pos.y)
        setPosition(event);
        img.x = Math.floor(pos.x - x_off);
        img.y = Math.floor(pos.y - y_off);
        drawCtx.drawImage(img.image, img.x, img.y, img.image.width, img.image.height);
        drawCanvas.style.cursor = "move";
        return;
    }
    if (event.buttons !== 1)
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

    drawCtx.stroke(); // draw it!
}

ethereumButton.addEventListener('click', async () => {
    //Will Start the metamask extension
    await ethereum.request({ method: 'eth_requestAccounts' });
});

hideButton.addEventListener('click', async () => {
    if (hideButton.textContent === "Hide")
    {
        hideButton.textContent = "Show";
        hideButton.style.backgroundColor = "green";
        drawCanvas.style.opacity = "0%";
    }
    else if (hideButton.textContent === "Show")
    {
        hideButton.textContent = "Opaque";
        hideButton.style.backgroundColor = "yellow";
        drawCanvas.style.opacity = "100%";
    }
    else
    {
        hideButton.textContent = "Hide";
        hideButton.style.backgroundColor = "red";
        drawCanvas.style.opacity = "50%";
    }
});

signTypedDataV3Button.addEventListener('click', async function(event) {
    event.preventDefault()

    const accounts = await ethereum.request({ method: 'eth_accounts' });
    addr = EthJS.Util.toChecksumAddress(accounts[0])

    const msgParams = JSON.stringify({
        types: {
            EIP712Domain: [
                {name:"name",type:"string"},
                {name:"version",type:"string"},
                {name:"chainId",type:"uint256"},
                {name:"salt",type:"bytes32"}
            ],
            Paint: [
                {name:"art_title",type:"string"},
                {name:"art_id",type:"string"},
                {name:"artist_address",type:"address"}
            ]
        },
        domain: {
            name:"POAP.art",
            version:"1",
            chainId:1,
            salt: '0xdea10b41b9cf1f4c6cf33150f19fb69dcef673e6c92a8fe734bb2bc11150cc45'
        },
        primaryType: "Paint",
        message:{
            art_title:"Week 20 - 2021",
            art_id:"nKOjzq",
            artist_address: addr
        }
    });


    let params = [addr, msgParams];
    let method = 'eth_signTypedData_v4';
    await window.ethereum.request(
        {
            method: method,
            params: params,
            from: addr,
            id: 1
        }
    ).then(function (result, err) {
        if (err)
            return console.dir(err);
        if (result.error) {
            alert(result.error.message);
        }
        if (result.error)
            return console.error('ERROR', result);

        let url = baseUrl + canvasId + "/signin"
        const data= {
            wallet: addr,
            chainId: 1,
            signature: result
        }
        const params = {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json'
            }
        }
        fetch(url, params)
            .then(data=>{return data.json()})
            .then(res=>{
                bearer = res["accessToken"];
            });

    })
});

async function getCurrentColor(x, y)
{
    const imageData = baseCtx.getImageData(x, y, 1, 1).data

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
        // need a error function for color bit depth downscale approximation; probably quadratic sum is most accurate ?
        let dist = Math.pow(Math.abs(r - col_r), 2)  + Math.pow(Math.abs(g - col_g),2) + Math.pow(Math.abs(b - col_b), 2);
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

startDraw.addEventListener('click', async function(event)
{
    if (startDraw.textContent === "Stop Drawing")
    {
        startDraw.style.backgroundColor = "green";
        startDraw.textContent = "3. Start Drawing!"
        return
    }
    startDraw.style.backgroundColor = "red";
    startDraw.textContent = "Stop Drawing"
    const imgData = drawCtx.getImageData(img.x, img.y, img.image.width, img.image.height).data;
    idx_array = [...Array(imgData.length / 4).keys()]
    const total = idx_array.length
    let progressBar = document.getElementById("progressbar").children
    for (;;)
    {
        if (startDraw.textContent !== "Stop Drawing")
            break
        if (idx_array.length === 0)
        {
            await delay(1000)
            continue
        }
        let percent = 100 * (total - idx_array.length) / total
        progressBar[1].style.width = percent + '%'
        progressBar[0].innerHTML = percent.toFixed(2) + "% drawn (" + (total - idx_array.length) + "/" + total + " Pixel)"
        let idx = getRandomInt(idx_array.length)
        let i = idx_array[idx] * 4
        const red = imgData[i];
        const green = imgData[i + 1];
        const blue = imgData[i + 2];
        const alpha = imgData[i + 3];
        if (alpha <= 16)    // almost transparent, we can probably hide it
        {
            idx_array.splice(idx, 1)
            continue
        }

        let min_idx = approximateColor(red, green, blue)
        const x = img.x + (i / 4 % img.image.width)
        const y = img.y + Math.trunc(((i / 4) / img.image.width))
        const col = await getCurrentColor(x, y);
        if (col !== palette[min_idx])
            await paintPixel(x, y, min_idx)
        else
            idx_array.splice(idx,1)
    }
})

// Image for loading
let img = {
    image: document.createElement("img"),
    x: 0,
    y: 0,
}
img.image.addEventListener("load", function () {
    //clearCanvas();
    drawCtx.drawImage(img.image, img.x, img.y);
}, false)

// To enable drag and drop
drawCanvas.addEventListener("dragover", function (evt) {
    evt.preventDefault();
}, false);


function loadWebImage(url)
{

}

drawCanvas.addEventListener("drop", function (evt) {
    var files = evt.dataTransfer.files;
    if (files.length > 0) {
        var file = files[0];
        if (typeof FileReader !== "undefined" && file.type.indexOf("image") != -1) {
            var reader = new FileReader();
// Note: addEventListener doesn't work in Google Chrome for this event
            reader.onload = function (evt) {
                img.x = Math.floor(pos.x);
                img.y = Math.floor(pos.y);
                img.image.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
    evt.preventDefault();
}, false);
