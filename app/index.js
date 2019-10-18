/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

const info = bowser.parse(window.navigator.userAgent);
const supportedBrowser =
    info.platform.type == "desktop" && info.engine.name == "Blink" && info.browser.version > "68";
const fileButton = document.getElementById("fileButton");
const channelInfo = document.getElementById("channelInfo");
const display = document.getElementById("display");
const screenSize = { width: 854, height: 480 };
const ctx = display.getContext("2d", { alpha: false });
const channel1 = document.getElementById("channel1");
const channel2 = document.getElementById("channel2");
const channel3 = document.getElementById("channel3");

const sounds = new Map();
sounds.set("select", new Howl({ src: ["./audio/select.wav"] }));
sounds.set("navsingle", new Howl({ src: ["./audio/navsingle.wav"] }));
sounds.set("navmulti", new Howl({ src: ["./audio/navmulti.wav"] }));
sounds.set("deadend", new Howl({ src: ["./audio/deadend.wav"] }));
let playList = new Array();
let playIndex = 0;

if (!supportedBrowser) {
    channelIcons("hidden");
    fileButton.style.visibility = "hidden";
    let infoHtml = "";
    infoHtml += "<br/>";
    infoHtml += "Your browser is not supported!";
    channelInfo.innerHTML = infoHtml;
} else {
    channelInfo.innerHTML = "<br/>";
}

const bufferCanvas = supportedBrowser
    ? new OffscreenCanvas(screenSize.width, screenSize.height)
    : undefined;
const bufferCtx = supportedBrowser ? bufferCanvas.getContext("2d") : undefined;
let buffer = new ImageData(screenSize.width, screenSize.height);
let splashTimeout = 1600;
let brsWorker;
let source = [];
let paths = [];
let txts = [];
let imgs = [];
let fonts = [];
let running = false;

// Control buffer
const length = 10;
const sharedBuffer = supportedBrowser
    ? new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length)
    : undefined;
const sharedArray = sharedBuffer ? new Int32Array(sharedBuffer) : undefined;

// Keyboard handlers
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

// Device Data
const developerId = "UniqueDeveloperId";
const deviceData = {
    developerId: developerId,
    registry: new Map(),
    deviceModel: "8000X",
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    countryCode: "US",
    timeZone: "US/Arizona",
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap", // Options: "Asap", "Roboto" or "Open Sans"
};

// Load Registry
const storage = window.localStorage;
for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key.substr(0, developerId.length) === developerId) {
        deviceData.registry.set(key, storage.getItem(key));
    }
}

// File selector
const fileSelector = document.getElementById("file");
const zip = new JSZip();
fileButton.onclick = function() {
    fileSelector.click();
};

fileSelector.onclick = function() {
    this.value = null;
};
fileSelector.onchange = function() {
    const file = this.files[0];
    const reader = new FileReader();
    reader.onload = function(progressEvent) {
        paths = [];
        imgs = [];
        txts = [];
        fonts = [];
        source.push(this.result);
        paths.push({ url: "source/" + file.name, id: 0, type: "source" });
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(0, 0, display.width, display.height);
        runChannel();
    };
    source = [];
    if (brsWorker != undefined) {
        brsWorker.terminate();
    }
    if (file.name.split(".").pop() === "zip") {
        console.log("Loading " + file.name + "...");
        running = true;
        openChannelZip(file);
    } else {
        running = true;
        reader.readAsText(file);
    }
    display.focus();
};

// Download Zip
function loadZip(zip) {
    if (running) {
        return;
    }
    running = true;
    display.style.opacity = 0;
    channelIcons("visible");
    fileSelector.value = null;
    source = [];
    if (brsWorker != undefined) {
        brsWorker.terminate();
    }
    fetch(zip).then(function(response) {
        if (response.status === 200 || response.status === 0) {
            console.log("Loading " + zip + "...");
            openChannelZip(response.blob());
            display.focus();
        } else {
            running = false;
            return Promise.reject(new Error(response.statusText));
        }
    });
}

// Uncompress Zip and execute
function openChannelZip(f) {
    JSZip.loadAsync(f).then(
        function(zip) {
            const manifest = zip.file("manifest");
            if (manifest) {
                manifest.async("string").then(
                    function success(content) {
                        const manifestMap = new Map();
                        content.match(/[^\r\n]+/g).map(function(ln) {
                            const line = ln.split("=");
                            manifestMap.set(line[0].toLowerCase(), line[1]);
                        });
                        const splashMinTime = manifestMap.get("splash_min_time");
                        if (splashMinTime && !isNaN(splashMinTime)) {
                            splashTimeout = parseInt(splashMinTime);
                        }
                        let splash;
                        if (deviceData.displayMode === "480p") {
                            splash = manifestMap.get("splash_screen_sd");
                            if (!splash) {
                                splash = manifestMap.get("splash_screen_hd");
                                if (!splash) {
                                    splash = manifestMap.get("splash_screen_fhd");
                                }
                            }
                        } else {
                            splash = manifestMap.get("splash_screen_hd");
                            if (!splash) {
                                splash = manifestMap.get("splash_screen_fhd");
                                if (!splash) {
                                    splash = manifestMap.get("splash_screen_sd");
                                }
                            }
                        }
                        ctx.fillStyle = "rgba(0, 0, 0, 1)";
                        ctx.fillRect(0, 0, display.width, display.height);
                        if (splash && splash.substr(0, 5) === "pkg:/") {
                            const splashFile = zip.file(splash.substr(5));
                            if (splashFile) {
                                splashFile.async("blob").then(blob => {
                                    createImageBitmap(blob).then(imgData => {
                                        channelIcons("hidden");
                                        display.style.opacity = 1;
                                        ctx.drawImage(
                                            imgData,
                                            0,
                                            0,
                                            screenSize.width,
                                            screenSize.height
                                        );
                                    });
                                });
                            }
                        }
                        fileButton.style.visibility = "hidden";
                        let infoHtml = "";
                        const title = manifestMap.get("title");
                        if (title) {
                            infoHtml += title + "<br/>";
                        }
                        const subtitle = manifestMap.get("subtitle");
                        if (subtitle) {
                            infoHtml += subtitle + "<br/>";
                        }
                        const majorVersion = manifestMap.get("major_version");
                        if (majorVersion) {
                            infoHtml += "v" + majorVersion;
                        }
                        const minorVersion = manifestMap.get("minor_version");
                        if (minorVersion) {
                            infoHtml += "." + minorVersion;
                        }
                        const buildVersion = manifestMap.get("build_version");
                        if (buildVersion) {
                            infoHtml += "." + buildVersion;
                        }
                        channelInfo.innerHTML = infoHtml;
                    },
                    function error(e) {
                        clientException("Error uncompressing manifest:" + e.message, true);
                        running = false;
                        return;
                    }
                );
            } else {
                clientException("Invalid Roku package: missing manifest.", true);
                running = false;
                return;
            }
            const assetPaths = [];
            const assetsEvents = [];
            let bmpId = 0;
            let txtId = 0;
            let srcId = 0;
            let fntId = 0;
            let audId = 0;
            zip.forEach(function(relativePath, zipEntry) {
                const lcasePath = relativePath.toLowerCase();
                const ext = lcasePath.split(".").pop();
                if (!zipEntry.dir && lcasePath.substr(0, 6) === "source" && ext === "brs") {
                    assetPaths.push({ url: relativePath, id: srcId, type: "source" });
                    assetsEvents.push(zipEntry.async("string"));
                    srcId++;
                } else if (
                    !zipEntry.dir &&
                    (lcasePath === "manifest" || ext === "csv" || ext === "xml" || ext === "json")
                ) {
                    assetPaths.push({ url: relativePath, id: txtId, type: "text" });
                    assetsEvents.push(zipEntry.async("string"));
                    txtId++;
                } else if (
                    !zipEntry.dir &&
                    (ext === "png" || ext === "gif" || ext === "jpg" || ext === "jpeg")
                ) {
                    assetPaths.push({ url: relativePath, id: bmpId, type: "image" });
                    assetsEvents.push(zipEntry.async("blob"));
                    bmpId++;
                } else if (!zipEntry.dir && (ext === "ttf" || ext === "otf")) {
                    assetPaths.push({ url: relativePath, id: fntId, type: "font" });
                    assetsEvents.push(zipEntry.async("arraybuffer"));
                    fntId++;
                } else if (
                    !zipEntry.dir &&
                    (ext === "wav" ||
                        ext === "mp3" ||
                        ext === "m4a" ||
                        ext === "wma" ||
                        ext === "flac")
                ) {
                    assetPaths.push({ url: relativePath, id: audId, type: "audio", format: ext });
                    assetsEvents.push(zipEntry.async("blob"));
                    audId++;
                }
            });
            Promise.all(assetsEvents).then(
                function success(assets) {
                    paths = [];
                    txts = [];
                    imgs = [];
                    fonts = [];
                    const bmpEvents = [];
                    for (let index = 0; index < assets.length; index++) {
                        paths.push(assetPaths[index]);
                        if (assetPaths[index].type === "image") {
                            bmpEvents.push(createImageBitmap(assets[index]));
                        } else if (assetPaths[index].type === "font") {
                            fonts.push(assets[index]);
                        } else if (assetPaths[index].type === "source") {
                            source.push(assets[index]);
                        } else if (assetPaths[index].type === "audio") {
                            sounds.set(
                                `pkg:/${assetPaths[index].url.toLowerCase()}`,
                                new Howl({
                                    src: [URL.createObjectURL(assets[index])],
                                    format: assetPaths[index].format,
                                })
                            );
                        } else if (assetPaths[index].type === "text") {
                            txts.push(assets[index]);
                        }
                    }
                    Promise.all(bmpEvents).then(
                        function success(bmps) {
                            bmps.forEach(bmp => {
                                imgs.push(bmp);
                            });
                            setTimeout(function() {
                                runChannel();
                            }, splashTimeout);
                        },
                        function error(e) {
                            clientException("Error converting image " + e.message);
                        }
                    );
                },
                function error(e) {
                    clientException("Error uncompressing file " + e.message);
                }
            );
        },
        function(e) {
            clientException("Error reading " + f.name + ": " + e.message, true);
            running = false;
        }
    );
}

// Execute Emulator Web Worker
function runChannel() {
    channelIcons("hidden");
    display.style.opacity = 1;
    display.focus();
    brsWorker = new Worker("./lib/brsEmu.js");
    brsWorker.addEventListener("message", receiveMessage);
    const payload = {
        device: deviceData,
        paths: paths,
        brs: source,
        texts: txts,
        fonts: fonts,
        images: imgs,
    };
    brsWorker.postMessage(sharedBuffer);
    brsWorker.postMessage(payload, imgs);
}

// Receive Messages from the Web Worker
function receiveMessage(event) {
    if (event.data instanceof ImageData) {
        buffer = event.data;
        bufferCanvas.width = buffer.width;
        bufferCanvas.height = buffer.height;
        bufferCtx.putImageData(buffer, 0, 0);
        ctx.drawImage(bufferCanvas, 0, 0, screenSize.width, screenSize.height);
    } else if (event.data instanceof Map) {
        deviceData.registry = event.data;
        deviceData.registry.forEach(function(value, key) {
            storage.setItem(key, value);
        });
    } else if (event.data instanceof Array) {
        playList = event.data;
        // TODO: Stop playback if playing, check if should restart
    } else if (event.data === "play") {
        const audio = playList[0]; // TODO: Get current index of playlist
        if (audio && sounds.has(audio.toLowerCase())) {
            const sound = sounds.get(audio.toLowerCase());
            sound.volume(1);
            sound.seek(0);
            sound.play();
        } else {
            console.log("Can't find audio data:", audio);
        }
    } else if (event.data === "stop") {
        const audio = playList[0]; // TODO: Get current index of playlist
        if (audio && sounds.has(audio.toLowerCase())) {
            sounds.get(audio.toLowerCase()).stop();
        } else {
            console.log("Can't find audio data:", audio);
        }
    } else if (event.data === "pause") {
        const audio = playList[0]; // TODO: Get current index of playlist
        if (audio && sounds.has(audio.toLowerCase())) {
            sounds.get(audio.toLowerCase()).pause();
        } else {
            console.log("Can't find audio data:", audio);
        }
    } else if (event.data === "resume") {
        const audio = playList[0]; // TODO: Get current index of playlist
        if (audio && sounds.has(audio.toLowerCase())) {
            sounds.get(audio.toLowerCase()).play();
        } else {
            console.log("Can't find audio data:", audio);
        }
    } else if (event.data.substr(0, 7) === "loop") {
        const audio = playList[0]; // TODO: Get current index of playlist
        const loop = event.data.split(",")[1];
        if (loop) {
            if (audio && sounds.has(audio.toLowerCase())) {
                const sound = sounds.get(audio.toLowerCase());
                sound.loop(loop === "true");
            } else {
                console.log("Can't find audio data:", audio);
            }
        } else {
            console.log("Invalid seek position:", event.data);
        }
    } else if (event.data.substr(0, 4) === "seek") {
        const audio = playList[0]; // TODO: Get current index of playlist
        const position = event.data.split(",")[1];
        if (position && !isNaN(parseInt(position))) {
            if (audio && sounds.has(audio.toLowerCase())) {
                const sound = sounds.get(audio.toLowerCase());
                sound.seek(parseInt(position));
            } else {
                console.log("Can't find audio data:", audio);
            }
        } else {
            console.log("Invalid seek position:", event.data);
        }
    } else if (event.data.substr(0, 7) === "trigger") {
        const wav = event.data.split(",")[1];
        if (wav && sounds.has(wav.toLowerCase())) {
            const volume = parseInt(event.data.split(",")[2]) / 100;
            const sound = sounds.get(wav.toLowerCase());
            if (volume && !isNaN(volume)) {
                sound.volume(volume);
            }
            sound.play();
        }
    } else if (event.data.substr(0, 5) === "stop,") {
        const wav = event.data.split(",")[1];
        if (wav && sounds.has(wav)) {
            sounds.get(wav).stop();
        } else {
            console.log("Can't find wav sound:", wav);
        }
    } else if (event.data === "end") {
        closeChannel();
    }
}

// Restore emulator menu and terminate Worker
function closeChannel() {
    display.style.opacity = 0;
    channelInfo.innerHTML = "<br/>";
    fileButton.style.visibility = "visible";
    channelIcons("visible");
    fileSelector.value = null;
    brsWorker.terminate();
    sharedArray[0] = 0;
    playList = new Array();
    playIndex = 0;
    running = false;
}

// Remote control emulator
function keyDownHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[0] = 0; // BUTTON_BACK_PRESSED
    } else if (event.keyCode == 13) {
        sharedArray[0] = 6; // BUTTON_SELECT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 37) {
        sharedArray[0] = 4; // BUTTON_LEFT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 39) {
        sharedArray[0] = 5; // BUTTON_RIGHT_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 38) {
        sharedArray[0] = 2; // BUTTON_UP_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 40) {
        sharedArray[0] = 3; // BUTTON_DOWN_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 111) {
        sharedArray[0] = 7; // BUTTON_INSTANT_REPLAY_PRESSED
    } else if (event.keyCode == 106) {
        sharedArray[0] = 10; // BUTTON_INFO_PRESSED
    } else if (event.keyCode == 188) {
        sharedArray[0] = 8; // BUTTON_REWIND_PRESSED
    } else if (event.keyCode == 32) {
        sharedArray[0] = 13; // BUTTON_PLAY_PRESSED
        event.preventDefault();
    } else if (event.keyCode == 190) {
        sharedArray[0] = 9; // BUTTON_FAST_FORWARD_PRESSED
    } else if (event.keyCode == 65) {
        sharedArray[0] = 17; // BUTTON_A_PRESSED
    } else if (event.keyCode == 90) {
        sharedArray[0] = 18; // BUTTON_B_PRESSED
    } else if (event.keyCode == 27) {
        if (brsWorker != undefined) {
            // HOME BUTTON (ESC)
            closeChannel();
        }
    }
    // TODO: Send TimeSinceLastKeypress()
}

function keyUpHandler(event) {
    if (event.keyCode == 8) {
        sharedArray[0] = 100; // BUTTON_BACK_RELEASED
    } else if (event.keyCode == 13) {
        sharedArray[0] = 106; // BUTTON_SELECT_RELEASED
    } else if (event.keyCode == 37) {
        sharedArray[0] = 104; // BUTTON_LEFT_RELEASED
    } else if (event.keyCode == 39) {
        sharedArray[0] = 105; // BUTTON_RIGHT_RELEASED
    } else if (event.keyCode == 38) {
        sharedArray[0] = 102; // BUTTON_UP_RELEASED
    } else if (event.keyCode == 40) {
        sharedArray[0] = 103; // BUTTON_DOWN_RELEASED
    } else if (event.keyCode == 111) {
        sharedArray[0] = 107; // BUTTON_INSTANT_REPLAY_RELEASED
    } else if (event.keyCode == 106) {
        sharedArray[0] = 110; // BUTTON_INFO_RELEASED
    } else if (event.keyCode == 188) {
        sharedArray[0] = 108; // BUTTON_REWIND_RELEASED
    } else if (event.keyCode == 32) {
        sharedArray[0] = 113; // BUTTON_PLAY_RELEASED
    } else if (event.keyCode == 190) {
        sharedArray[0] = 109; // BUTTON_FAST_FORWARD_RELEASED
    } else if (event.keyCode == 65) {
        sharedArray[0] = 117; // BUTTON_A_RELEASED
    } else if (event.keyCode == 90) {
        sharedArray[0] = 118; // BUTTON_B_RELEASED
    }
}

// Channel icons Visibility
function channelIcons(visibility) {
    if (channel3) {
        channel1.style.visibility = visibility;
        channel2.style.visibility = visibility;
        channel3.style.visibility = visibility;
    }
}

// Exception Handler
function clientException(msg, msgbox = false) {
    console.error(msg);
    if (msgbox) {
        window.alert(msg);
    }
}
