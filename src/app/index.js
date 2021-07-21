/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Hammer, { Tap } from "hammerjs";
import bowser from "bowser";
import { subscribeDevice, deviceData, loadFile } from "./device";
import { handleKey} from "./control";
const info = bowser.parse(window.navigator.userAgent);
const supportedBrowser =
    info.engine.name == "Blink" &&
    ((info.platform.type == "desktop" && info.browser.version.substr(0, 2) > "68") ||
        info.browser.version.substr(0, 2) > "89");
const fileButton = document.getElementById("fileButton");
const channelInfo = document.getElementById("channelInfo");
const libVersion = document.getElementById("libVersion");
const display = document.getElementById("display");
const loading = document.getElementById("loading");
const channel1 = document.getElementById("channel1");
const channel2 = document.getElementById("channel2");
const channel3 = document.getElementById("channel3");

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
let running = false;

// Device Data
const developerId = "UniqueDeveloperId";
const deviceInfo = {
    developerId: developerId,
    friendlyName: "BrightScript Emulator",
    serialNumber: "BRSEMUAPP091",
    deviceModel: "8000X",
    firmwareVersion: "049.10E04111A",
    clientId: "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
    RIDA: "f51ac698-bc60-4409-aae3-8fc3abc025c4", // Unique identifier for advertisement tracking
    countryCode: "US",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en_US",
    clockFormat: "12h",
    displayMode: "720p", // Supported modes: 480p (SD), 720p (HD) and 1080p (FHD)
    defaultFont: "Asap", // Default: "Asap" to use alternative fonts "Roboto" or "Open Sans"
    fontPath: "../fonts/", // change the fontPath to "../fonts-alt/"
    maxSimulStreams: 2, // Max number of audio resource streams
    connectionType: "WiFiConnection", // Options: "WiFiConnection", "WiredConnection", ""
    localIps: ["eth1,127.0.0.1"], // Running on the Browser is not possible to get a real IP
    startTime: Date.now(),
    audioVolume: 40,
};
Object.assign(deviceData, deviceInfo);

subscribeDevice("app", (event, data) => {
    if (event === "loaded") {
        fileButton.style.visibility = "hidden";
        let infoHtml = data.title + "<br/>";
        infoHtml += data.subtitle + "<br/>";
        infoHtml += data.version;
        channelInfo.innerHTML = infoHtml;
    } else if (event === "running") {
        channelIcons("hidden");
        loading.style.visibility = "hidden";
    } else if (event === "closed" || event === "error") {
        display.style.opacity = 0;
        channelInfo.innerHTML = "<br/>";
        fileButton.style.visibility = "visible";
        loading.style.visibility = "hidden";
        channelIcons("visible");
        fileSelector.value = null;
        running = false;
    } else if (event === "icon") {
        console.log("received icon event from device");
    } else if (event === "reset") {
        console.log("received reset event from device");
    } else if (event === "version") {
        libVersion.innerHTML = data;
    }
});


// Shared buffers
const dataType = { KEY: 0, MOD: 1, SND: 2, IDX: 3, WAV: 4 };
Object.freeze(dataType);
const length = 7;
let sharedBuffer = [0, 0, 0, 0, 0, 0, 0];
if (supportedBrowser && info.browser.version.substr(0, 2) > "91" && !self.crossOriginIsolated) {
    console.warn(
        "Keyboard control will not work as SharedArrayBuffer is not enabled, to know more visit https://developer.chrome.com/blog/enabling-shared-array-buffer/"
    );
} else if (supportedBrowser) {
    sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * length);
}
const sharedArray = new Int32Array(sharedBuffer);

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
fileButton.onclick = function() {
    fileSelector.click();
};
fileSelector.onclick = function() {
    this.value = null;
};
fileSelector.onchange = function() {
    const file = this.files[0];
    const reader = new FileReader();
    const fileExt = file.name.split(".").pop();
    if (fileExt === "zip" || fileExt === "brs") {
        reader.onload = function(evt) {
            // file is loaded
            loadFile(file.name, evt.target.result);
            channelIcons("hidden");
        };
        reader.onerror = function (evt) {
            console.error(`Error opening ${file.name}:${reader.error}`);
        }
        reader.readAsArrayBuffer(file);
    } else {
        console.error(`File format not supported: ${fileExt}`);
    }
};
// Download Zip
export function loadZip(zip) {
    if (running) {
        return;
    }
    running = true;
    display.style.opacity = 0;
    loading.style.visibility = "visible";
    channelIcons("visible");
    fileSelector.value = null;
    fetch(zip).then(function (response) {
        if (response.status === 200 || response.status === 0) {
            console.log(`Loading ${zip}...`);
            loadFile(zip, response.blob());
            display.focus();
        } else {
            loading.style.visibility = "hidden";
            running = false;
            return Promise.reject(new Error(response.statusText));
        }
    });
}
// Remote control emulator

// Touch handlers
const mc = new Hammer(display);
// let the pan gesture support all directions.
// this will block the vertical scrolling on a touch-device while on the element
mc.get('pan').set({ direction: Hammer.DIRECTION_ALL });

// listen to events...
var singleTap = new Tap({event: 'tap' });
var doubleTap = new Tap({event: 'doubletap', taps: 2 });
mc.add([doubleTap, singleTap]);
doubleTap.recognizeWith(singleTap);
singleTap.requireFailure(doubleTap);
mc.on("panleft panright panup pandown tap doubletap", function(ev) {
    console.log(ev.type);
    if (ev.type.substr(0,3) === "pan") {
        sendKeyPress(ev.type.substr(3));
    } else if (ev.type === "tap") {
        sendKeyPress("select");
    } else if (ev.type === "doubletap") {
        sendKeyPress("back");
    }
});

function sendKeyPress(key) {
    setTimeout(function () {
        handleKey(key, 100);
    }, 300);
    handleKey(key, 0);
}

// Channel icons Visibility
function channelIcons(visibility) {
    if (channel3) {
        channel1.style.visibility = visibility;
        channel2.style.visibility = visibility;
        channel3.style.visibility = visibility;
    }
}
